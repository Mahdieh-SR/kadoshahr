import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { OrderStatusBadge } from "@/components/order/OrderStatusBadge";
import {
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
} from "@/components/ui/icons";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { formatDateTime, formatNumber, formatToman } from "@/lib/format";

export const metadata: Metadata = { title: "نتیجه پرداخت" };
export const dynamic = "force-dynamic";

export default async function OrderResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/order/${id}/result`);

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
      refId: true,
      cardPan: true,
      failureReason: true,
      paidAt: true,
      createdAt: true,
      firstName: true,
      lastName: true,
      email: true,
      province: true,
      city: true,
      address: true,
      postalCode: true,
      deliveryNote: true,
      userId: true,
      items: {
        select: {
          id: true,
          productTitle: true,
          variantLabel: true,
          quantity: true,
          unitPrice: true,
        },
      },
    },
  });

  // سفارش باید وجود داشته باشد و متعلق به همین کاربر باشد.
  // بدون این بررسی، هر کسی با حدس زدن شناسه می‌توانست سفارش دیگران را ببیند.
  if (!order || (order.userId !== user.id && user.role !== "ADMIN")) {
    notFound();
  }

  // ⚠️ وضعیت از دیتابیس خوانده می‌شود — نه از پارامترهای آدرس.
  const succeeded = order.status === "PAID" || order.status === "DELIVERED";
  const pending = order.status === "PENDING_PAYMENT";

  return (
    <div className="container-page flex justify-center py-14">
      <div className="w-full max-w-2xl">
        {/* وضعیت */}
        <div
          className={`rounded-card border p-8 text-center ${
            succeeded
              ? "border-success/40 bg-success/5"
              : pending
                ? "border-warning/40 bg-warning/5"
                : "border-danger/40 bg-danger/5"
          }`}
        >
          <span
            className={`inline-flex h-16 w-16 items-center justify-center rounded-full ${
              succeeded
                ? "bg-success/15 text-success"
                : pending
                  ? "bg-warning/15 text-warning"
                  : "bg-danger/15 text-danger"
            }`}
          >
            {succeeded ? (
              <CheckCircleIcon width={34} height={34} />
            ) : pending ? (
              <ClockIcon width={34} height={34} />
            ) : (
              <XCircleIcon width={34} height={34} />
            )}
          </span>

          <h1 className="mt-5 text-xl font-black sm:text-2xl">
            {succeeded
              ? "پرداخت با موفقیت انجام شد"
              : pending
                ? "پرداخت هنوز کامل نشده است"
                : "پرداخت ناموفق بود"}
          </h1>

          <p className="mt-3 text-sm leading-7 text-muted">
            {succeeded
              ? "سفارش شما ثبت شد. کد خریداری‌شده پس از بررسی برایتان ارسال می‌شود."
              : pending
                ? "اگر مبلغ از حساب شما کم شده، تا دقایقی دیگر وضعیت به‌روز می‌شود."
                : (order.failureReason ??
                  "تراکنش تایید نشد. اگر مبلغی کم شده، طی ۷۲ ساعت برمی‌گردد.")}
          </p>

          <div className="mt-6 flex justify-center">
            <OrderStatusBadge status={order.status} />
          </div>
        </div>

        {/* جزئیات سفارش */}
        <div className="mt-6 rounded-card border border-ink-800 bg-ink-900 p-6">
          <h2 className="text-sm font-bold">جزئیات سفارش</h2>

          <dl className="mt-5 flex flex-col gap-4 text-sm">
            <Row label="کد سفارش" value={<strong>{order.orderNumber}</strong>} />
            <Row label="تاریخ ثبت" value={formatDateTime(order.createdAt)} />
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
            <Row
              label="گیرنده"
              value={`${order.firstName} ${order.lastName}`}
            />
            <Row
              label="ایمیل"
              value={
                <span dir="ltr" className="text-xs">
                  {order.email}
                </span>
              }
            />
          </dl>

          {order.address && (
            <div className="mt-6 border-t border-ink-800 pt-5">
              <h3 className="text-xs font-bold text-muted">آدرس ارسال</h3>
              <p className="mt-2 text-sm leading-7 text-fg">
                {order.province}، {order.city}
                <br />
                {order.address}
              </p>
              <p className="mt-2 text-xs text-muted">
                کد پستی:{" "}
                <span dir="ltr" className="font-mono">
                  {order.postalCode}
                </span>
              </p>
            </div>
          )}

          <ul className="mt-6 flex flex-col gap-3 border-t border-ink-800 pt-5">
            {order.items.map((item) => (
              <li key={item.id} className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="text-sm">{item.productTitle}</p>
                  <p className="mt-1 text-xs text-muted">
                    {item.variantLabel} × {formatNumber(item.quantity)}
                  </p>
                </div>
                <span className="text-sm">
                  {formatToman(item.unitPrice * item.quantity)}
                </span>
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
            <span className="text-sm font-bold">مبلغ پرداخت‌شده</span>
            <span className="text-lg font-black text-accent-400">
              {formatToman(order.totalAmount)}
            </span>
          </div>
        </div>

        {/* یادداشت تحویل — مثلاً کد گیفت‌کارت که ادمین ثبت کرده */}
        {order.deliveryNote && succeeded && (
          <div className="mt-6 rounded-card border border-accent-400/40 bg-accent-400/5 p-6">
            <h2 className="text-sm font-bold text-accent-400">
              اطلاعات تحویل سفارش
            </h2>
            <p className="mt-3 text-sm leading-7 whitespace-pre-line text-fg">
              {order.deliveryNote}
            </p>
          </div>
        )}

        {/* اقدام‌ها */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {succeeded || pending ? (
            <ButtonLink href="/account/orders" size="lg">
              پیگیری سفارش
            </ButtonLink>
          ) : (
            <ButtonLink href="/cart" size="lg">
              تلاش دوباره برای پرداخت
            </ButtonLink>
          )}
          <ButtonLink href="/products" variant="secondary" size="lg">
            بازگشت به فروشگاه
          </ButtonLink>
        </div>

        <p className="mt-6 text-center text-xs text-muted">
          سوالی دارید؟{" "}
          <Link href="/account/orders" className="text-accent-400 hover:underline">
            از پنل کاربری پیگیری کنید
          </Link>
        </p>
      </div>
    </div>
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
