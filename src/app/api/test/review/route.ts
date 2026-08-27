import { NextResponse } from "next/server";
import { moderateReview } from "@/app/actions/admin";
import { submitReview } from "@/app/actions/review";

/**
 * مسیر مخصوص تست خودکار برای نظرات.
 * همان اکشن‌های واقعی را صدا می‌زند؛ بررسی دسترسی داخل خودشان انجام می‌شود.
 *
 * 🔒 در حالت production کاملاً غیرفعال است.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const body = await request.json().catch(() => null);

  const result =
    body?.__action === "moderate"
      ? await moderateReview(body)
      : await submitReview(body);

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
