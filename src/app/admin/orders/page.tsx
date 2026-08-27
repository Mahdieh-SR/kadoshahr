import Link from "next/link";
import { Suspense } from "react";
import { OrderFilters } from "@/components/admin/OrderFilters";
import { OrderStatusBadge } from "@/components/order/OrderStatusBadge";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatDateTime, formatNumber, formatToman } from "@/lib/format";
import { orderStatusSchema } from "@/lib/validation";
import { normalizePhone } from "@/lib/validation";

type SearchParams = { status?: string; q?: string };

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireAdmin();
  const { status, q } = await searchParams;

  // وضعیت فقط اگر یکی از مقادیر مجاز باشد اعمال می‌شود
  const parsedStatus = orderStatusSchema.safeParse(status);
  const term = q?.trim();

  // اگر عبارت جستجو شبیه شماره موبایل بود، به شکل استاندارد درمی‌آید
  const asPhone = term ? normalizePhone(term) : null;

  const orders = await prisma.order.findMany({
    where: {
      ...(parsedStatus.success ? { status: parsedStatus.data } : {}),
      ...(term
        ? {
            OR: [
              { orderNumber: { contains: term, mode: "insensitive" as const } },
              { firstName: { contains: term, mode: "insensitive" as const } },
              { lastName: { contains: term, mode: "insensitive" as const } },
              { email: { contains: term, mode: "insensitive" as const } },
              { refId: { contains: term, mode: "insensitive" as const } },
              ...(asPhone ? [{ user: { phone: asPhone } }] : []),
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      firstName: true,
      lastName: true,
      city: true,
      province: true,
      user: { select: { phone: true } },
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-black">سفارش‌ها</h1>
        <p className="mt-2 text-sm text-muted">
          این فهرست همیشه با دیتابیس یکی است — هیچ نسخه‌ی جداگانه‌ای نگه داشته
          نمی‌شود.
        </p>
      </div>

      <Suspense fallback={<div className="h-28" />}>
        <OrderFilters />
      </Suspense>

      <p className="text-sm text-muted">
        {orders.length > 0
          ? `${formatNumber(orders.length)} سفارش`
          : "سفارشی با این فیلتر پیدا نشد"}
        {orders.length === 100 && " (۱۰۰ مورد آخر)"}
      </p>

      {orders.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-ink-800">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-ink-900 text-xs text-muted">
              <tr>
                <Th>کد سفارش</Th>
                <Th>مشتری</Th>
                <Th>مقصد</Th>
                <Th>مبلغ</Th>
                <Th>تاریخ</Th>
                <Th>وضعیت</Th>
                <Th> </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-800">
              {orders.map((order) => (
                <tr key={order.id} className="bg-ink-950 hover:bg-ink-900">
                  <Td>
                    <span className="font-bold">{order.orderNumber}</span>
                    <span className="mt-1 block text-[11px] text-muted">
                      {formatNumber(order._count.items)} قلم
                    </span>
                  </Td>
                  <Td>
                    <span>
                      {order.firstName} {order.lastName}
                    </span>
                    <span dir="ltr" className="mt-1 block text-[11px] text-muted">
                      {order.user.phone}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-xs text-muted">
                      {order.province ? `${order.province}، ${order.city}` : "—"}
                    </span>
                  </Td>
                  <Td>{formatToman(order.totalAmount)}</Td>
                  <Td>
                    <span className="text-xs text-muted">
                      {formatDateTime(order.createdAt)}
                    </span>
                  </Td>
                  <Td>
                    <OrderStatusBadge status={order.status} />
                  </Td>
                  <Td>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="text-xs font-bold text-accent-400 hover:underline"
                    >
                      جزئیات
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-start font-medium">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-4 align-top">{children}</td>;
}
