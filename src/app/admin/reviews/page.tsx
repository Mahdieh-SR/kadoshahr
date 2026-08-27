import Link from "next/link";
import { ReviewCard } from "@/components/admin/ReviewCard";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/cn";

const tabs = [
  { value: "PENDING", label: "در انتظار تایید" },
  { value: "APPROVED", label: "تاییدشده" },
  { value: "REJECTED", label: "رد شده" },
  { value: "", label: "همه" },
] as const;

type SearchParams = { status?: string };

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const { status } = await searchParams;

  const valid = ["PENDING", "APPROVED", "REJECTED"] as const;
  const active = valid.includes(status as (typeof valid)[number])
    ? (status as (typeof valid)[number])
    : status === ""
      ? ""
      : "PENDING";

  const [reviews, pendingCount] = await Promise.all([
    prisma.review.findMany({
      where: active ? { status: active } : {},
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        rating: true,
        comment: true,
        adminReply: true,
        status: true,
        createdAt: true,
        user: { select: { name: true, phone: true } },
        product: { select: { title: true, slug: true } },
      },
    }),
    prisma.review.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-black">نظرات مشتریان</h1>
        <p className="mt-2 text-sm leading-7 text-muted">
          نظرها تا وقتی تاییدشان نکنید در سایت دیده نمی‌شوند. فقط کسانی که محصول
          را خریده‌اند می‌توانند نظر بدهند.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.value || "all"}
            href={tab.value ? `/admin/reviews?status=${tab.value}` : "/admin/reviews?status="}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors",
              active === tab.value
                ? "border-accent-400 bg-accent-400/10 font-bold text-accent-400"
                : "border-ink-700 text-muted hover:border-ink-600 hover:text-fg"
            )}
          >
            {tab.label}
            {tab.value === "PENDING" && pendingCount > 0 && (
              <span className="rounded-md bg-warning px-1.5 text-[10px] font-bold text-ink-950">
                {formatNumber(pendingCount)}
              </span>
            )}
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <p className="rounded-card border border-dashed border-ink-700 p-12 text-center text-sm text-muted">
          نظری با این فیلتر وجود ندارد.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {reviews.map((r) => (
            <ReviewCard
              key={r.id}
              review={{
                id: r.id,
                rating: r.rating,
                comment: r.comment,
                adminReply: r.adminReply,
                status: r.status,
                createdAt: r.createdAt.toISOString(),
                authorName: r.user.name || "بدون نام",
                authorPhone: r.user.phone,
                productTitle: r.product.title,
                productSlug: r.product.slug,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
