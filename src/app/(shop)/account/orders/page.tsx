import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { OrderStatusBadge } from "@/components/order/OrderStatusBadge";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatDateTime, formatNumber, formatToman } from "@/lib/format";

export const metadata: Metadata = { title: "سفارش‌های من" };

export default async function AccountOrdersPage() {
  const user = await requireUser("/account/orders");

  // فقط سفارش‌های همین کاربر — فیلتر userId روی سرور اعمال می‌شود تا کسی
  // نتواند با دستکاری درخواست، سفارش دیگران را ببیند.
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      items: {
        select: { id: true, productTitle: true, variantLabel: true, quantity: true },
      },
    },
  });

  if (orders.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-ink-700 p-14 text-center">
        <p className="text-base font-bold">هنوز سفارشی ثبت نکرده‌اید</p>
        <p className="mt-2 text-sm text-muted">
          بعد از اولین خرید، سفارش‌هایتان اینجا فهرست می‌شود.
        </p>
        <div className="mt-7 flex justify-center">
          <ButtonLink href="/products">رفتن به فروشگاه</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {orders.map((order) => (
        <li
          key={order.id}
          className="rounded-card border border-ink-800 bg-ink-900 p-5"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold">سفارش {order.orderNumber}</p>
              <p className="mt-1 text-xs text-muted">
                {formatDateTime(order.createdAt)}
              </p>
            </div>
            <OrderStatusBadge status={order.status} />
          </div>

          <ul className="mt-4 flex flex-col gap-2 border-t border-ink-800 pt-4">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <span className="text-fg">{item.productTitle}</span>
                <span className="text-muted">
                  {item.variantLabel} × {formatNumber(item.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink-800 pt-4">
            <span className="text-sm font-bold">
              {formatToman(order.totalAmount)}
            </span>
            <Link
              href={`/order/${order.id}/result`}
              className="text-sm text-accent-400 hover:underline"
            >
              جزئیات و پیگیری
            </Link>
          </div>
        </li>
      ))}
    </ul>
  );
}
