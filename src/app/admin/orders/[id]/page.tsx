import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyButton } from "@/components/admin/CopyButton";
import { OrderStatusForm } from "@/components/admin/OrderStatusForm";
import { OrderStatusBadge } from "@/components/order/OrderStatusBadge";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatDateTime, formatNumber, formatToman } from "@/lib/format";

export default async function AdminOrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true,
      subtotalAmount: true,
      discountAmount: true,
      discountCode: true,
      firstName: true,
      lastName: true,
      email: true,
      province: true,
      city: true,
      address: true,
      postalCode: true,
      authority: true,
      refId: true,
      cardPan: true,
      failureReason: true,
      paidAt: true,
      createdAt: true,
      deliveryNote: true,
      user: { select: { id: true, phone: true, name: true } },
      items: {
        select: {
          id: true,
          productTitle: true,
          variantLabel: true,
          quantity: true,
          unitPrice: true,
          variant: { select: { stock: true, product: { select: { slug: true } } } },
        },
      },
    },
  });

  if (!order) notFound();

  const fullAddress = order.address
    ? `${order.firstName} ${order.lastName}\n${order.province}، ${order.city}\n${order.address}\nکد پستی: ${order.postalCode}\nتلفن: ${order.user.phone}`
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
        >
          <ChevronLeftIcon width={14} height={14} />
          بازگشت به فهرست سفارش‌ها
        </Link>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-black">سفارش {order.orderNumber}</h1>
          <OrderStatusBadge status={order.status} />
        </div>
        <p className="mt-2 text-sm text-muted">
          ثبت شده در {formatDateTime(order.createdAt)}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px] xl:items-start">
        <div className="flex flex-col gap-6">
          {/* آدرس پستی — چیزی که برای ارسال لازم دارید */}
          <Section
            title="آدرس ارسال"
            action={
              fullAddress ? (
                <CopyButton text={fullAddress} label="کپی آدرس" />
              ) : undefined
            }
          >
            {order.address ? (
              <div className="text-sm leading-8">
                <p className="font-bold">
                  {order.firstName} {order.lastName}
                </p>
                <p className="text-muted">
                  {order.province}، {order.city}
                </p>
                <p>{order.address}</p>
                <p className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted">
                  <span>
                    کد پستی:{" "}
                    <span dir="ltr" className="font-mono text-fg">
                      {order.postalCode}
                    </span>
                  </span>
                  <span>
                    تلفن:{" "}
                    <span dir="ltr" className="font-mono text-fg">
                      {order.user.phone}
                    </span>
                  </span>
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted">
                این سفارش قبل از اضافه شدن آدرس ثبت شده و آدرسی ندارد.
              </p>
            )}
          </Section>

          {/* اقلام */}
          <Section title="اقلام سفارش">
            <ul className="flex flex-col gap-4">
              {order.items.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-800 pb-4 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/product/${item.variant.product.slug}`}
                      className="text-sm font-bold hover:text-accent-400"
                    >
                      {item.productTitle}
                    </Link>
                    <p className="mt-1 text-xs text-muted">{item.variantLabel}</p>
                    <p className="mt-1 text-[11px] text-muted">
                      موجودی فعلی این نسخه: {formatNumber(item.variant.stock)}
                    </p>
                  </div>
                  <div className="text-end">
                    <p className="text-sm">
                      {formatToman(item.unitPrice)} ×{" "}
                      {formatNumber(item.quantity)}
                    </p>
                    <p className="mt-1 text-sm font-bold">
                      {formatToman(item.unitPrice * item.quantity)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {order.discountAmount > 0 && (
              <dl className="mt-5 flex flex-col gap-2 border-t border-ink-800 pt-5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">جمع جزء</dt>
                  <dd>{formatToman(order.subtotalAmount)}</dd>
                </div>
                <div className="flex justify-between text-accent-400">
                  <dt>تخفیف ({order.discountCode})</dt>
                  <dd>− {formatToman(order.discountAmount)}</dd>
                </div>
              </dl>
            )}

            <div className="mt-5 flex items-baseline justify-between border-t border-ink-800 pt-5">
              <span className="text-sm font-bold">مبلغ پرداختی</span>
              <span className="text-lg font-black text-accent-400">
                {formatToman(order.totalAmount)}
              </span>
            </div>
          </Section>

          {/* اطلاعات تراکنش */}
          <Section title="اطلاعات پرداخت">
            <dl className="flex flex-col gap-3 text-sm">
              <Row label="ایمیل مشتری" value={<span dir="ltr">{order.email}</span>} />
              {order.paidAt && (
                <Row label="تاریخ پرداخت" value={formatDateTime(order.paidAt)} />
              )}
              {order.refId && (
                <Row
                  label="شماره پیگیری بانک"
                  value={
                    <span dir="ltr" className="font-mono text-xs">
                      {order.refId}
                    </span>
                  }
                />
              )}
              {order.cardPan && (
                <Row
                  label="کارت پرداخت"
                  value={
                    <span dir="ltr" className="font-mono text-xs">
                      {order.cardPan}
                    </span>
                  }
                />
              )}
              {order.authority && (
                <Row
                  label="شناسه تراکنش"
                  value={
                    <span dir="ltr" className="font-mono text-[11px] break-all">
                      {order.authority}
                    </span>
                  }
                />
              )}
              {order.failureReason && (
                <Row
                  label="دلیل ناموفق بودن"
                  value={<span className="text-danger">{order.failureReason}</span>}
                />
              )}
            </dl>
          </Section>
        </div>

        {/* ستون اقدام */}
        <div className="rounded-card border border-ink-800 bg-ink-900 p-5 xl:sticky xl:top-8">
          <h2 className="text-sm font-bold">تغییر وضعیت</h2>
          <p className="mt-2 mb-5 text-xs leading-6 text-muted">
            بعد از ارسال بسته، وضعیت را روی «تحویل‌شده» بگذارید و در صورت نیاز کد
            رهگیری را در یادداشت بنویسید.
          </p>

          <OrderStatusForm
            orderId={order.id}
            currentStatus={order.status}
            currentNote={order.deliveryNote ?? ""}
          />
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-ink-800 bg-ink-900 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-fg">{value}</dd>
    </div>
  );
}
