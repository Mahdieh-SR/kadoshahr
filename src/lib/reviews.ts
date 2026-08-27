import { prisma } from "./prisma";

export type PublicReview = {
  id: string;
  rating: number;
  comment: string;
  adminReply: string | null;
  createdAt: Date;
  authorName: string;
};

/** نام نمایشی نویسنده — اگر نام نداشته باشد، شماره‌اش پوشانده می‌شود */
function displayName(name: string | null, phone: string): string {
  if (name && name.trim()) return name.trim();
  return `${phone.slice(0, 4)}***${phone.slice(-3)}`;
}

/**
 * فقط کسی می‌تواند نظر بدهد که همین محصول را واقعاً خریده و پرداختش موفق
 * بوده باشد. این جلوی نظرهای جعلی و تبلیغاتی را می‌گیرد.
 */
export async function hasPurchased(
  userId: string,
  productId: string
): Promise<boolean> {
  const count = await prisma.order.count({
    where: {
      userId,
      status: { in: ["PAID", "DELIVERED"] },
      items: { some: { variant: { productId } } },
    },
  });
  return count > 0;
}

export type ReviewEligibility =
  | { canReview: true }
  | { canReview: false; reason: string; alreadyReviewed?: boolean };

export async function checkEligibility(
  userId: string | null,
  productId: string
): Promise<ReviewEligibility> {
  if (!userId) {
    return { canReview: false, reason: "برای ثبت نظر ابتدا وارد حساب خود شوید." };
  }

  const existing = await prisma.review.findUnique({
    where: { productId_userId: { productId, userId } },
    select: { status: true },
  });

  if (existing) {
    return {
      canReview: false,
      alreadyReviewed: true,
      reason:
        existing.status === "PENDING"
          ? "نظر شما ثبت شده و در انتظار تایید مدیر است."
          : existing.status === "APPROVED"
            ? "نظر شما برای این محصول ثبت و منتشر شده است."
            : "نظر شما برای این محصول تایید نشد.",
    };
  }

  if (!(await hasPurchased(userId, productId))) {
    return {
      canReview: false,
      reason: "فقط کسانی که این محصول را خریده‌اند می‌توانند نظر ثبت کنند.",
    };
  }

  return { canReview: true };
}

/** نظرهای تاییدشده‌ی یک محصول */
export async function getProductReviews(
  productId: string
): Promise<PublicReview[]> {
  const reviews = await prisma.review.findMany({
    where: { productId, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      rating: true,
      comment: true,
      adminReply: true,
      createdAt: true,
      user: { select: { name: true, phone: true } },
    },
  });

  return reviews.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    adminReply: r.adminReply,
    createdAt: r.createdAt,
    authorName: displayName(r.user.name, r.user.phone),
  }));
}

/**
 * شمارنده‌های امتیاز محصول را از روی نظرهای تاییدشده بازمحاسبه می‌کند.
 * بعد از هر تایید/رد/حذف نظر صدا زده می‌شود تا عدد روی کارت محصول درست بماند.
 */
export async function recalculateProductRating(productId: string) {
  const agg = await prisma.review.aggregate({
    where: { productId, status: "APPROVED" },
    _count: { _all: true },
    _sum: { rating: true },
  });

  await prisma.product.update({
    where: { id: productId },
    data: {
      reviewCount: agg._count._all,
      ratingSum: agg._sum.rating ?? 0,
    },
  });
}

/** میانگین امتیاز با یک رقم اعشار — اگر نظری نباشد null */
export function averageRating(
  ratingSum: number,
  reviewCount: number
): number | null {
  if (reviewCount <= 0) return null;
  return Math.round((ratingSum / reviewCount) * 10) / 10;
}
