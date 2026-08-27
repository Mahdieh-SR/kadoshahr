import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { OrderStatusBadge } from "@/components/order/OrderStatusBadge";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatDate, formatNumber, formatToman } from "@/lib/format";

export const metadata: Metadata = { title: "پیشخوان" };

export default async function AccountDashboard() {
  const user = await requireUser("/account");

  const [counts, recentOrders, paidAgg] = await Promise.all([
    prisma.order.groupBy({
      by: ["status"],
      where: { userId: user.id },
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        createdAt: true,
      },
    }),
    prisma.order.aggregate({
      where: { userId: user.id, status: { in: ["PAID", "DELIVERED"] } },
      _sum: { totalAmount: true },
    }),
  ]);

  const totalOrders = counts.reduce((sum, c) => sum + c._count._all, 0);
  const countOf = (status: string) =>
    counts.find((c) => c.status === status)?._count._all ?? 0;

  const cards = [
    { label: "همه سفارش‌ها", value: formatNumber(totalOrders) },
    { label: "در انتظار پرداخت", value: formatNumber(countOf("PENDING_PAYMENT")) },
    {
      label: "پرداخت‌شده و تحویل‌شده",
      value: formatNumber(countOf("PAID") + countOf("DELIVERED")),
    },
    {
      label: "مجموع خرید",
      value: formatToman(paidAgg._sum.totalAmount ?? 0),
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-card border border-ink-800 bg-ink-900 p-5"
          >
            <p className="text-xs text-muted">{c.label}</p>
            <p className="mt-2 text-xl font-black text-fg">{c.value}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-bold">آخرین سفارش‌ها</h2>
          {totalOrders > 0 && (
            <Link
              href="/account/orders"
              className="text-sm text-muted hover:text-accent-400"
            >
              دیدن همه
            </Link>
          )}
        </div>

        {recentOrders.length === 0 ? (
          <div className="mt-5 rounded-card border border-dashed border-ink-700 p-12 text-center">
            <p className="text-sm text-muted">هنوز سفارشی ثبت نکرده‌اید.</p>
            <div className="mt-6 flex justify-center">
              <ButtonLink href="/products">شروع خرید</ButtonLink>
            </div>
          </div>
        ) : (
          <ul className="mt-5 flex flex-col gap-3">
            {recentOrders.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/order/${order.id}/result`}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-ink-800 bg-ink-900 p-4 transition-colors hover:border-ink-600"
                >
                  <div>
                    <p className="text-sm font-bold">
                      سفارش {order.orderNumber}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
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
