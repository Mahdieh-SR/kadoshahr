import { NextResponse } from "next/server";
import { startCheckout } from "@/app/actions/checkout";

/**
 * مسیر مخصوص تست خودکار.
 *
 * فرم واقعی سایت از Server Action استفاده می‌کند که از بیرون قابل صدا زدن
 * نیست؛ این مسیر همان تابع را صدا می‌زند تا اسکریپت‌های تست بتوانند مسیر
 * پرداخت را سرتاسری بررسی کنند.
 *
 * 🔒 در حالت production کاملاً غیرفعال است و ۴۰۴ برمی‌گرداند.
 * منطق تجاری اینجا تکرار نشده — دقیقاً همان startCheckout اجرا می‌شود،
 * پس تست‌ها روی کد واقعی اجرا می‌شوند نه یک نسخه‌ی جداگانه.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const result = await startCheckout(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
