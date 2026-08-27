import { NextResponse } from "next/server";
import { updateOrderStatus } from "@/app/actions/admin";

/**
 * مسیر مخصوص تست خودکار — همان اکشن واقعی ادمین را صدا می‌زند تا بشود
 * بررسی کرد که کاربر عادی نمی‌تواند وضعیت سفارش را تغییر دهد.
 *
 * 🔒 در حالت production کاملاً غیرفعال است و ۴۰۴ برمی‌گرداند.
 * بررسی نقش داخل خود اکشن انجام می‌شود، نه اینجا — پس این مسیر هیچ
 * دسترسی اضافه‌ای نمی‌دهد.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const result = await updateOrderStatus(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
