import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { evaluateDiscount } from "@/lib/discount";
import { priceCart } from "@/lib/pricing";
import { getClientIp, rateLimit, tooManyRequestsMessage } from "@/lib/rate-limit";
import { cartItemInputSchema } from "@/lib/validation";
import { MAX_CART_LINES } from "@/lib/constants";

const bodySchema = z.object({
  code: z.string().min(1).max(32),
  items: z.array(cartItemInputSchema).min(1).max(MAX_CART_LINES),
});

/**
 * پیش‌نمایش تخفیف برای صفحه‌ی سبد و تسویه‌حساب.
 *
 * 🔒 محافظت در برابر حدس زدن کد: بدون سقف درخواست، یک بات می‌توانست
 * هزاران کد را امتحان کند تا کد تخفیف معتبر پیدا کند. سقف هم روی IP
 * و هم روی حساب کاربری اعمال می‌شود.
 *
 * ⚠️ نتیجه‌ی این مسیر فقط برای «نمایش» است. مبلغ واقعی سفارش دوباره
 * هنگام ثبت سفارش سمت سرور محاسبه می‌شود.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { ok: false, error: "برای استفاده از کد تخفیف باید وارد حساب خود شوید." },
      { status: 401 }
    );
  }

  const ip = await getClientIp();
  const byUser = await rateLimit(`discount:user:${session.user.id}`, 15, 600);
  const byIp = await rateLimit(`discount:ip:${ip}`, 40, 600);

  if (!byUser.ok || !byIp.ok) {
    const wait = Math.max(byUser.retryAfterSeconds, byIp.retryAfterSeconds);
    return NextResponse.json(
      {
        ok: false,
        error: `تعداد تلاش برای کد تخفیف زیاد بود. ${tooManyRequestsMessage(wait)}`,
      },
      { status: 429 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "درخواست نامعتبر است." },
      { status: 400 }
    );
  }

  // جمع سبد از دیتابیس محاسبه می‌شود، نه از عددی که مرورگر فرستاده
  const priced = await priceCart(parsed.data.items);
  if (!priced.ok) {
    return NextResponse.json({ ok: false, error: priced.error }, { status: 400 });
  }

  const result = await evaluateDiscount({
    rawCode: parsed.data.code,
    subtotal: priced.subtotal,
    userId: session.user.id,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 200 });
  }

  return NextResponse.json({
    ok: true,
    code: result.code,
    label: result.label,
    amount: result.amount,
    subtotal: priced.subtotal,
    total: priced.subtotal - result.amount,
  });
}
