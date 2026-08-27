"use server";

import { randomBytes } from "node:crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { priceCart } from "@/lib/pricing";
import { getClientIp, rateLimit, tooManyRequestsMessage } from "@/lib/rate-limit";
import { checkoutSchema } from "@/lib/validation";
import { evaluateDiscount } from "@/lib/discount";
import { requestPayment } from "@/lib/zarinpal";

export type CheckoutResult =
  | { ok: true; paymentUrl: string; orderNumber: string }
  | { ok: false; error: string };

/** کد سفارش قابل خواندن برای مشتری، مثل GL-7K2P4Q */
function generateOrderNumber(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(6);
  let out = "";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `GL-${out}`;
}

/**
 * ثبت سفارش و شروع پرداخت.
 *
 * ترتیب کارها عمداً این است:
 *   ۱. کاربر باید وارد شده باشد
 *   ۲. سقف تعداد درخواست
 *   ۳. اعتبارسنجی ورودی سمت سرور
 *   ۴. قیمت‌گذاری از روی دیتابیس (نه از روی چیزی که مرورگر فرستاده)
 *   ۵. ساخت سفارش با وضعیت «در انتظار پرداخت»
 *   ۶. درخواست به درگاه با همان مبلغ محاسبه‌شده
 */
export async function startCheckout(input: unknown): Promise<CheckoutResult> {
  // ۱) احراز هویت
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "برای ثبت سفارش باید وارد حساب خود شوید." };
  }

  // ۲) سقف تعداد درخواست — این مسیر هم سفارش می‌سازد و هم به درگاه وصل می‌شود
  const ip = await getClientIp();
  const byUser = await rateLimit(`checkout:user:${session.user.id}`, 10, 600);
  const byIp = await rateLimit(`checkout:ip:${ip}`, 20, 600);
  if (!byUser.ok || !byIp.ok) {
    const wait = Math.max(byUser.retryAfterSeconds, byIp.retryAfterSeconds);
    return { ok: false, error: tooManyRequestsMessage(wait) };
  }

  // ۳) اعتبارسنجی ورودی — فرض نمی‌کنیم درخواست از فرم سایت آمده است
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "اطلاعات وارد شده معتبر نیست.",
    };
  }
  const {
    firstName,
    lastName,
    email,
    items,
    province,
    city,
    address,
    postalCode,
    discountCode,
  } = parsed.data;

  // ۴) قیمت‌گذاری از دیتابیس — هیچ قیمتی از ورودی خوانده نمی‌شود
  const priced = await priceCart(items);
  if (!priced.ok) {
    return { ok: false, error: priced.error };
  }

  // ۴٫۵) کد تخفیف — درصد و مبلغش از دیتابیس خوانده می‌شود، نه از مرورگر.
  // اگر کد نامعتبر بود، سفارش متوقف می‌شود تا کاربر مبلغی غیر از آنچه دیده
  // پرداخت نکند.
  let discountAmount = 0;
  let discountCodeId: string | null = null;
  let discountLabel: string | null = null;

  if (discountCode && discountCode.trim()) {
    const evaluated = await evaluateDiscount({
      rawCode: discountCode,
      subtotal: priced.subtotal,
      userId: session.user.id,
    });

    if (!evaluated.ok) {
      return { ok: false, error: evaluated.error };
    }

    discountAmount = evaluated.amount;
    discountCodeId = evaluated.codeId;
    discountLabel = evaluated.code;
  }

  const payable = priced.subtotal - discountAmount;

  // ۵) ساخت سفارش
  let order;
  try {
    order = await prisma.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        status: "PENDING_PAYMENT",
        subtotalAmount: priced.subtotal,
        discountAmount,
        discountCode: discountLabel,
        discountCodeId,
        totalAmount: payable,
        firstName,
        lastName,
        email,
        // آدرس در لحظه‌ی خرید روی سفارش کپی می‌شود تا تغییر بعدی پروفایل،
        // آدرس سفارش‌های قبلی را عوض نکند.
        province,
        city,
        address,
        postalCode,
        userId: session.user.id,
        items: {
          create: priced.lines.map((line) => ({
            productTitle: line.productTitle,
            variantLabel: line.variantLabel,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            variantId: line.variantId,
          })),
        },
      },
      select: { id: true, orderNumber: true, totalAmount: true },
    });
  } catch (e) {
    console.error("خطا در ساخت سفارش:", e);
    return { ok: false, error: "ثبت سفارش انجام نشد. دوباره تلاش کنید." };
  }

  // آدرس روی پروفایل هم ذخیره می‌شود تا خرید بعدی خودکار پر شود.
  // اگر این کار شکست بخورد، سفارش نباید متوقف شود.
  prisma.user
    .update({
      where: { id: session.user.id },
      data: {
        province,
        city,
        address,
        postalCode,
        ...(firstName || lastName
          ? { name: `${firstName} ${lastName}`.trim() }
          : {}),
        email,
      },
    })
    .catch(() => undefined);

  // ۶) درخواست به درگاه با مبلغ محاسبه‌شده‌ی سرور
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const payment = await requestPayment({
    amountToman: order.totalAmount,
    description: `پرداخت سفارش ${order.orderNumber}`,
    callbackUrl: `${base}/api/payment/verify`,
    mobile: session.user.phone,
    email,
  });

  if (!payment.ok) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "FAILED", failureReason: payment.error },
    });
    return { ok: false, error: payment.error };
  }

  // authority روی سفارش ذخیره می‌شود تا موقع برگشت از درگاه بتوانیم
  // سفارش متناظر را پیدا کنیم.
  await prisma.order.update({
    where: { id: order.id },
    data: { authority: payment.authority },
  });

  return {
    ok: true,
    paymentUrl: payment.paymentUrl,
    orderNumber: order.orderNumber,
  };
}
