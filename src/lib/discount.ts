import { prisma } from "./prisma";
import { toLatinDigits } from "./format";

export type DiscountEvaluation =
  | {
      ok: true;
      codeId: string;
      code: string;
      /** مبلغ تخفیف به تومان */
      amount: number;
      /** توضیح کوتاه برای نمایش، مثلاً «۲۰٪ تخفیف» */
      label: string;
    }
  | { ok: false; error: string };

/** کد را یکدست می‌کند: حروف بزرگ انگلیسی، بدون فاصله، ارقام لاتین */
export function normalizeDiscountCode(raw: string): string {
  return toLatinDigits(String(raw ?? ""))
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/**
 * بررسی می‌کند که کد تخفیف برای این کاربر و این مبلغ قابل استفاده است یا نه،
 * و مبلغ تخفیف را حساب می‌کند.
 *
 * ⚠️ همه‌ی محاسبه اینجا و از روی رکورد دیتابیس انجام می‌شود. هیچ عددی از
 * مرورگر خوانده نمی‌شود — نه درصد، نه مبلغ تخفیف، نه جمع سبد.
 */
export async function evaluateDiscount(params: {
  rawCode: string;
  subtotal: number;
  userId: string;
}): Promise<DiscountEvaluation> {
  const code = normalizeDiscountCode(params.rawCode);

  if (!code) return { ok: false, error: "کد تخفیف را وارد کنید." };
  if (code.length > 32) return { ok: false, error: "کد تخفیف معتبر نیست." };

  const record = await prisma.discountCode.findUnique({ where: { code } });

  // پیام عمداً یکسان است تا نشود با آزمون و خطا فهمید کدام کد وجود دارد
  if (!record || !record.isActive) {
    return { ok: false, error: "این کد تخفیف معتبر نیست." };
  }

  const now = new Date();

  if (record.startsAt && record.startsAt > now) {
    return { ok: false, error: "این کد هنوز فعال نشده است." };
  }

  if (record.expiresAt && record.expiresAt < now) {
    return { ok: false, error: "این کد تخفیف منقضی شده است." };
  }

  // ⚠️ مبنای شمارش، خودِ سفارش‌های پرداخت‌شده است — نه شمارنده‌ی usedCount.
  // شمارنده فقط برای نمایش در پنل است و اگر به هر دلیلی (مثلاً قطعی لحظه‌ای
  // شبکه) به‌روز نشود، نباید سقف استفاده دور زده شود.
  const PAID_STATUSES = ["PAID", "DELIVERED"] as const;

  if (record.usageLimit > 0) {
    const paidOrders = await prisma.order.count({
      where: { discountCodeId: record.id, status: { in: [...PAID_STATUSES] } },
    });
    // هرکدام بیشتر بود ملاک است: شمارنده سریع است، شمارش سفارش‌ها دقیق.
    const totalUsed = Math.max(record.usedCount, paidOrders);
    if (totalUsed >= record.usageLimit) {
      return { ok: false, error: "ظرفیت استفاده از این کد تمام شده است." };
    }
  }

  if (params.subtotal < record.minOrderAmount) {
    const need = record.minOrderAmount - params.subtotal;
    return {
      ok: false,
      error: `این کد برای سفارش‌های بالای ${record.minOrderAmount.toLocaleString("fa-IR")} تومان است. ${need.toLocaleString("fa-IR")} تومان دیگر به سبد اضافه کنید.`,
    };
  }

  // سقف استفاده برای هر کاربر — بر اساس استفاده‌های موفق ثبت‌شده
  if (record.perUserLimit > 0) {
    // همان دلیل بالا: سفارش پرداخت‌شده مبنا است، نه رکورد جانبی
    const usedByUser = await prisma.order.count({
      where: {
        discountCodeId: record.id,
        userId: params.userId,
        status: { in: [...PAID_STATUSES] },
      },
    });
    if (usedByUser >= record.perUserLimit) {
      return {
        ok: false,
        error:
          record.perUserLimit === 1
            ? "شما قبلاً از این کد استفاده کرده‌اید."
            : `شما تا ${record.perUserLimit.toLocaleString("fa-IR")} بار می‌توانستید از این کد استفاده کنید.`,
      };
    }
  }

  // محاسبه‌ی مبلغ تخفیف
  let amount: number;
  let label: string;

  if (record.type === "PERCENT") {
    amount = Math.floor((params.subtotal * record.value) / 100);
    if (record.maxDiscountAmount > 0) {
      amount = Math.min(amount, record.maxDiscountAmount);
    }
    label = `${record.value.toLocaleString("fa-IR")}٪ تخفیف`;
  } else {
    amount = record.value;
    label = `${record.value.toLocaleString("fa-IR")} تومان تخفیف`;
  }

  // تخفیف هرگز از مبلغ سبد بیشتر نمی‌شود؛ مبلغ نهایی منفی یا صفر نباشد.
  // حداقل ۱۰۰۰ تومان باقی می‌ماند چون درگاه مبلغ کمتر را نمی‌پذیرد.
  const maxAllowed = Math.max(0, params.subtotal - 1000);
  amount = Math.min(amount, maxAllowed);

  if (amount <= 0) {
    return {
      ok: false,
      error: "این کد برای سبد فعلی شما تخفیفی ایجاد نمی‌کند.",
    };
  }

  return { ok: true, codeId: record.id, code: record.code, amount, label };
}
