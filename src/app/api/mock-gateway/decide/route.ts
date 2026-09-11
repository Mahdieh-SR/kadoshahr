import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMockMode } from "@/lib/zarinpal";
import { baseUrl } from "@/lib/base-url";

/**
 * ثبت تصمیم کاربر در درگاه ساختگی («پرداخت کردم» یا «انصراف دادم»).
 *
 * این مسیر عمداً یک فرم HTML ساده را می‌پذیرد، دقیقاً مثل یک درگاه واقعی که
 * سایت جداگانه‌ای است. تصمیم اینجا سمت سرور ثبت می‌شود و بعد کاربر به آدرس
 * بازگشت هدایت می‌شود — همان‌جا که سایت دوباره از درگاه می‌پرسد نتیجه چه بود.
 *
 * 🔒 وقتی ZARINPAL_MODE روی sandbox یا live باشد، این مسیر ۴۰۴ می‌دهد.
 */
export async function POST(request: Request) {
  if (!isMockMode()) return new NextResponse(null, { status: 404 });

  const base = baseUrl();

  const form = await request.formData();
  const authority = String(form.get("authority") ?? "");
  const approved = form.get("decision") === "approve";

  const payment = await prisma.mockPayment.findUnique({ where: { authority } });
  if (!payment) {
    return NextResponse.redirect(
      new URL("/payment-error?reason=order-not-found", base),
      303
    );
  }

  // تصمیم فقط یک بار ثبت می‌شود؛ اگر کاربر صفحه را رفرش کند یا برگردد،
  // نتیجه‌ی قبلی تغییر نمی‌کند.
  const finalApproved = payment.approved ?? approved;
  if (payment.approved === null) {
    await prisma.mockPayment.update({
      where: { authority },
      data: { approved },
    });
  }

  const status = finalApproved ? "OK" : "NOK";
  const target = new URL("/api/payment/verify", base);
  target.searchParams.set("Authority", authority);
  target.searchParams.set("Status", status);

  // ۳۰۳ لازم است تا مرورگر درخواست بعدی را با GET بفرستد، نه POST.
  return NextResponse.redirect(target, 303);
}
