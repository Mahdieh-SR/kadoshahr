import Link from "next/link";
import { OrderStatusBadge } from "@/components/order/OrderStatusBadge";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatDateTime, formatNumber, formatToman } from "@/lib/format";

export default async function AdminDashboard() {
  await requireAdmin();

  const [byStatus, revenue, productCount, lowStock, recent] = await Promise.all([
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.order.aggregate({
      where: { status: { in: ["PAID", "DELIVERED"] } },
      _sum: { totalAmount: true },
    }),
    prisma.product.count({ where: { isActive: true } }),
    prisma.productVariant.count({ where: { isActive: true, stock: { lte: 3 } } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        firstName: true,
        lastName: true,
      },
    }),
  ]);

  const countOf = (status: string) =>
    byStatus.find((b) => b.status === status)?._count._all ?? 0;

  // سفارش‌های پرداخت‌شده‌ای که هنوز تحویل نشده‌اند — کاری که باید انجام شود
  const needsAction = countOf("PAID");

  const cards = [
    {
      label: "منتظر ارسال",
      value: formatNumber(needsAction),
      hint: "پرداخت شده ولی هنوز تحویل نشده",
      highlight: needsAction > 0,
    },
    { label: "تحویل‌شده", value: formatNumber(countOf("DELIVERED")) },
    { label: "درآمد کل", value: formatToman(revenue._sum.totalAmount ?? 0) },
    {
      label: "محصولات فعال",
      value: formatNumber(productCount),
      hint:
        lowStock > 0
          ? `${formatNumber(lowStock)} وردایانت رو به اتمام است`
          : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-black">پیشخوان</h1>
        <p className="mt-2 text-sm text-muted">
          خلاصه‌ی وضعیت فروشگاه. همه‌ی اعداد مستقیم از دیتابیس خوانده می‌شوند.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className={
              card.highlight
                ? "rounded-card border border-accent-400/50 bg-accent-400/5 p-5"
                : "rounded-card border border-ink-800 bg-ink-900 p-5"
            }
          >
            <p className="text-xs text-muted">{card.label}</p>
            <p
              className={
                card.highlight
                  ? "mt-2 text-xl font-black text-accent-400"
                  : "mt-2 text-xl font-black text-fg"
              }
            >
              {card.value}
            </p>
            {card.hint && (
              <p className="mt-2 text-[11px] leading-5 text-muted">{card.hint}</p>
            )}
          </div>
        ))}
      </section>

      {needsAction > 0 && (
        <Link
          href="/admin/orders?status=PAID"
          className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-accent-400/40 bg-accent-400/5 p-5 transition-colors hover:bg-accent-400/10"
        >
          <span className="text-sm">
            <strong className="text-accent-400">
              {formatNumber(needsAction)} سفارش
            </strong>{" "}
            پرداخت شده و منتظر ارسال است.
          </span>
          <span className="shrink-0 text-sm font-bold text-accent-400">
            رسیدگی ←
          </span>
        </Link>
      )}

      <section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-base font-bold">آخرین سفارش‌ها</h2>
          <Link
            href="/admin/orders"
            className="text-sm text-muted hover:text-accent-400"
          >
            همه سفارش‌ها
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="mt-5 rounded-card border border-dashed border-ink-700 p-10 text-center text-sm text-muted">
            هنوز سفارشی ثبت نشده است.
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-2">
            {recent.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-800 bg-ink-900 p-4 transition-colors hover:border-ink-600"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold">{order.orderNumber}</p>
                    <p className="mt-1 truncate text-xs text-muted">
                      {order.firstName} {order.lastName} —{" "}
                      {formatDateTime(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="text-sm">
                      {formatToman(order.totalAmount)}
                    </span>
                    <OrderStatusBadge status={order.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
