import { NextResponse } from "next/server";
import { refreshSuggestedRate, saveUsdRate } from "@/app/actions/admin";

/**
 * مسیر مخصوص تست خودکار برای نرخ دلار.
 * همان اکشن‌های واقعی را صدا می‌زند؛ بررسی نقش داخل خودشان انجام می‌شود.
 *
 * 🔒 در حالت production کاملاً غیرفعال است.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  const body = await request.json().catch(() => null);

  if (body?.__action === "refresh") {
    const result = await refreshSuggestedRate();
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  const result = await saveUsdRate(body);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
