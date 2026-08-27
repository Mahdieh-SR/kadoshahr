"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { checkEligibility } from "@/lib/reviews";
import { getClientIp, rateLimit, tooManyRequestsMessage } from "@/lib/rate-limit";
import { reviewSchema } from "@/lib/validation";

export type ReviewResult = { ok: boolean; message?: string; error?: string };

/**
 * ثبت نظر توسط مشتری.
 *
 * سه شرط سمت سرور بررسی می‌شود:
 *   ۱. کاربر وارد شده باشد
 *   ۲. همین محصول را واقعاً خریده و پرداختش موفق بوده باشد
 *   ۳. قبلاً برای این محصول نظر نداده باشد
 *
 * نظر با وضعیت «در انتظار تایید» ثبت می‌شود و تا تایید مدیر در سایت
 * نمایش داده نمی‌شود.
 */
export async function submitReview(input: unknown): Promise<ReviewResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "برای ثبت نظر ابتدا وارد حساب خود شوید." };
  }

  const ip = await getClientIp();
  const limit = await rateLimit(`review:${session.user.id}:${ip}`, 10, 3600);
  if (!limit.ok) {
    return { ok: false, error: tooManyRequestsMessage(limit.retryAfterSeconds) };
  }

  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "اطلاعات وارد شده معتبر نیست.",
    };
  }

  const { productId, rating, comment } = parsed.data;

  // بررسی خرید و تکراری نبودن — همان منطقی که صفحه هم استفاده می‌کند
  const eligibility = await checkEligibility(session.user.id, productId);
  if (!eligibility.canReview) {
    return { ok: false, error: eligibility.reason };
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { slug: true },
  });
  if (!product) return { ok: false, error: "محصول پیدا نشد." };

  await prisma.review.create({
    data: { productId, userId: session.user.id, rating, comment },
  });

  revalidatePath(`/product/${product.slug}`);
  revalidatePath("/admin/reviews");

  return {
    ok: true,
    message: "نظر شما ثبت شد و پس از تایید مدیر نمایش داده می‌شود. ممنون!",
  };
}
