import { randomBytes } from "node:crypto";
import { prisma } from "./prisma";

/**
 * لایه‌ی ارتباط با درگاه پرداخت زرین‌پال.
 *
 * سه حالت دارد و با ZARINPAL_MODE در فایل .env انتخاب می‌شود:
 *   mock    → درگاه ساختگی داخلی، برای تست بدون هیچ کلیدی
 *   sandbox → محیط تست خود زرین‌پال
 *   live    → درگاه واقعی
 *
 * ⚠️ نکته‌ی کلیدی: مبلغ در هر دو مرحله‌ی «درخواست» و «تایید» از دیتابیس
 * خوانده می‌شود. زرین‌پال هم موقع تایید، مبلغ را مقایسه می‌کند؛ اگر مبلغ
 * تایید با مبلغ درخواست یکی نباشد تراکنش رد می‌شود.
 */

export type ZarinpalMode = "mock" | "sandbox" | "live";

export function getMode(): ZarinpalMode {
  const mode = (process.env.ZARINPAL_MODE ?? "mock").toLowerCase();
  if (mode === "live" || mode === "sandbox") return mode;
  return "mock";
}

export function isMockMode(): boolean {
  return getMode() === "mock";
}

function baseUrl(): string {
  return getMode() === "sandbox"
    ? "https://sandbox.zarinpal.com"
    : "https://payment.zarinpal.com";
}

function merchantId(): string {
  const id = process.env.ZARINPAL_MERCHANT_ID ?? "";
  if (getMode() !== "mock" && id.length !== 36) {
    throw new Error(
      "ZARINPAL_MERCHANT_ID تنظیم نشده یا معتبر نیست. باید یک رشته‌ی ۳۶ کاراکتری باشد."
    );
  }
  return id;
}

/**
 * زرین‌پال مبلغ را به «ریال» می‌گیرد، ولی قیمت‌های سایت به «تومان» ذخیره
 * می‌شوند. تبدیل فقط همین‌جا انجام می‌شود تا جای دیگری اشتباه نشود.
 */
export function tomanToRial(toman: number): number {
  return toman * 10;
}

export type PaymentRequestResult =
  | { ok: true; authority: string; paymentUrl: string }
  | { ok: false; error: string };

export async function requestPayment(params: {
  amountToman: number;
  description: string;
  callbackUrl: string;
  mobile?: string;
  email?: string;
}): Promise<PaymentRequestResult> {
  const { amountToman, description, callbackUrl, mobile, email } = params;

  if (!Number.isInteger(amountToman) || amountToman < 1000) {
    return { ok: false, error: "مبلغ سفارش معتبر نیست." };
  }

  // ── درگاه ساختگی ──
  if (isMockMode()) {
    const authority = `MOCK${randomBytes(14).toString("hex").toUpperCase()}`;
    await prisma.mockPayment.create({
      data: { authority, amount: amountToman, approved: null },
    });
    return {
      ok: true,
      authority,
      paymentUrl: `/mock-gateway?authority=${authority}`,
    };
  }

  // ── زرین‌پال واقعی / سندباکس ──
  try {
    const res = await fetch(`${baseUrl()}/pg/v4/payment/request.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        merchant_id: merchantId(),
        amount: tomanToRial(amountToman),
        description,
        callback_url: callbackUrl,
        metadata: {
          ...(mobile ? { mobile } : {}),
          ...(email ? { email } : {}),
        },
      }),
    });

    const json = (await res.json()) as {
      data?: { code?: number; authority?: string; message?: string };
      errors?: { code?: number; message?: string } | unknown[];
    };

    const code = json.data?.code;
    const authority = json.data?.authority;

    if (code === 100 && authority) {
      return {
        ok: true,
        authority,
        paymentUrl: `${baseUrl()}/pg/StartPay/${authority}`,
      };
    }

    const errors = json.errors;
    const message =
      (!Array.isArray(errors) && (errors as { message?: string })?.message) ||
      json.data?.message ||
      "درگاه پرداخت درخواست را نپذیرفت.";

    return { ok: false, error: message };
  } catch {
    return {
      ok: false,
      error: "ارتباط با درگاه پرداخت برقرار نشد. کمی بعد دوباره تلاش کنید.",
    };
  }
}

export type PaymentVerifyResult =
  | { ok: true; refId: string; cardPan: string | null; alreadyVerified: boolean }
  | { ok: false; error: string; code?: number };

/**
 * تایید پرداخت — این تابع همیشه سمت سرور صدا زده می‌شود.
 *
 * ⚠️ مهم‌ترین قانون این پروژه: پارامتر Status که زرین‌پال در آدرس برگشتی
 * می‌فرستد هرگز مبنای «موفق بودن» نیست، چون کاربر می‌تواند آدرس را دستکاری کند.
 * تنها چیزی که قابل اتکاست، پاسخ همین درخواست سرور‌به‌سرور است.
 */
export async function verifyPayment(params: {
  authority: string;
  amountToman: number;
}): Promise<PaymentVerifyResult> {
  const { authority, amountToman } = params;

  // ── درگاه ساختگی ──
  if (isMockMode()) {
    const record = await prisma.mockPayment.findUnique({ where: { authority } });

    if (!record) {
      return { ok: false, error: "تراکنش در درگاه پیدا نشد." };
    }
    if (record.approved !== true) {
      return { ok: false, error: "پرداخت توسط کاربر تایید نشد یا لغو شد." };
    }
    // همان بررسی مبلغی که درگاه واقعی انجام می‌دهد
    if (record.amount !== amountToman) {
      return { ok: false, error: "مبلغ تراکنش با مبلغ سفارش هم‌خوانی ندارد." };
    }

    return {
      ok: true,
      refId: `MOCK-${authority.slice(4, 14)}`,
      cardPan: "6037********1234",
      alreadyVerified: false,
    };
  }

  // ── زرین‌پال واقعی / سندباکس ──
  try {
    const res = await fetch(`${baseUrl()}/pg/v4/payment/verify.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        merchant_id: merchantId(),
        amount: tomanToRial(amountToman),
        authority,
      }),
    });

    const json = (await res.json()) as {
      data?: { code?: number; ref_id?: number | string; card_pan?: string };
      errors?: { code?: number; message?: string } | unknown[];
    };

    const code = json.data?.code;

    // ۱۰۰ = تایید شد، ۱۰۱ = قبلاً تایید شده بود (هر دو یعنی پول رسیده)
    if (code === 100 || code === 101) {
      return {
        ok: true,
        refId: String(json.data?.ref_id ?? ""),
        cardPan: json.data?.card_pan ?? null,
        alreadyVerified: code === 101,
      };
    }

    const errors = json.errors;
    const errObj = !Array.isArray(errors)
      ? (errors as { code?: number; message?: string })
      : undefined;

    return {
      ok: false,
      error: errObj?.message ?? "پرداخت تایید نشد.",
      code: errObj?.code ?? code,
    };
  } catch {
    return {
      ok: false,
      error: "ارتباط با درگاه برای تایید پرداخت برقرار نشد.",
    };
  }
}
