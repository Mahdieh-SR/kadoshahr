"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart, MAX_QTY_PER_ITEM } from "./CartProvider";
import { CouponBox, type AppliedCoupon } from "./CouponBox";
import { ButtonLink } from "@/components/ui/Button";
import { MinusIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { formatNumber, formatToman } from "@/lib/format";

type ServerItem = {
  variantId: string;
  productSlug: string;
  title: string;
  variantLabel: string;
  image: string | null;
  price: number;
  compareAtPrice: number | null;
  stock: number;
  available: boolean;
};

export function CartView({ isLoggedIn }: { isLoggedIn: boolean }) {
  const { lines, ready, setQuantity, remove } = useCart();
  const [serverItems, setServerItems] = useState<Map<string, ServerItem>>(
    new Map()
  );
  const [loading, setLoading] = useState(true);
  const [coupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);

  const variantKey = lines
    .map((l) => l.variantId)
    .sort()
    .join(",");

  // قیمت و موجودی همیشه از سرور خوانده می‌شود، نه از چیزی که در مرورگر ذخیره شده.
  useEffect(() => {
    if (!ready) return;

    if (lines.length === 0) {
      setServerItems(new Map());
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantIds: lines.map((l) => l.variantId) }),
    })
      .then((r) => r.json())
      .then((data: { ok: boolean; items?: ServerItem[] }) => {
        if (cancelled || !data.ok || !data.items) return;
        setServerItems(new Map(data.items.map((i) => [i.variantId, i])));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantKey, ready]);

  if (!ready || (loading && lines.length > 0)) {
    return (
      <div className="rounded-card border border-ink-800 p-12 text-center text-sm text-muted">
        در حال بارگذاری سبد…
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-ink-700 p-14 text-center">
        <p className="text-base font-bold">سبد خرید شما خالی است</p>
        <p className="mt-2 text-sm text-muted">
          از فهرست محصولات یک گیفت‌کارت یا اشتراک انتخاب کنید.
        </p>
        <div className="mt-7 flex justify-center">
          <ButtonLink href="/products">رفتن به فروشگاه</ButtonLink>
        </div>
      </div>
    );
  }

  // هر ردیف با داده‌ی سرور ترکیب می‌شود؛ اگر کالا پیدا نشد یعنی حذف شده است.
  const rows = lines.map((line) => {
    const server = serverItems.get(line.variantId);
    return {
      line,
      server,
      unitPrice: server?.price ?? line.price,
      missing: !server,
      unavailable: server ? !server.available : true,
      overStock: server ? line.quantity > server.stock : false,
    };
  });

  const validRows = rows.filter((r) => !r.missing && !r.unavailable && !r.overStock);
  const problemRows = rows.filter((r) => r.missing || r.unavailable || r.overStock);

  const subtotal = validRows.reduce(
    (sum, r) => sum + r.unitPrice * r.line.quantity,
    0
  );

  // تخفیف فقط تا سقف مبلغ سبد اعمال می‌شود؛ عدد نهایی را سرور دوباره حساب می‌کند
  const discount = coupon ? Math.min(coupon.amount, subtotal) : 0;
  const total = Math.max(0, subtotal - discount);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="flex flex-col gap-3">
        {rows.map(({ line, server, unitPrice, missing, unavailable, overStock }) => {
          const maxQty = Math.min(MAX_QTY_PER_ITEM, server?.stock ?? 0);
          const hasProblem = missing || unavailable || overStock;

          return (
            <article
              key={line.variantId}
              className="flex gap-4 rounded-card border border-ink-800 bg-ink-900 p-4"
            >
              <Link
                href={`/product/${line.productSlug}`}
                className="h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-ink-800"
              >
                {line.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={line.image}
                    alt={line.title}
                    className="h-full w-full object-cover"
                  />
                )}
              </Link>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/product/${line.productSlug}`}
                      className="block truncate text-sm font-bold hover:text-accent-400"
                    >
                      {server?.title ?? line.title}
                    </Link>
                    <p className="mt-1 truncate text-xs text-muted">
                      {server?.variantLabel ?? line.variantLabel}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => remove(line.variantId)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                    aria-label={`حذف ${line.title} از سبد`}
                  >
                    <TrashIcon width={18} height={18} />
                  </button>
                </div>

                {hasProblem ? (
                  <p className="text-xs text-danger">
                    {missing || unavailable
                      ? "این کالا دیگر موجود نیست — لطفاً حذفش کنید."
                      : `فقط ${formatNumber(server?.stock ?? 0)} عدد موجود است — تعداد را کم کنید.`}
                  </p>
                ) : (
                  <p className="text-xs text-muted">
                    قیمت واحد: {formatToman(unitPrice)}
                  </p>
                )}

                <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex h-10 items-center rounded-xl border border-ink-700">
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(line.variantId, line.quantity - 1)
                      }
                      className="flex h-full w-10 items-center justify-center text-muted transition-colors hover:text-fg"
                      aria-label="کاهش تعداد"
                    >
                      <MinusIcon width={16} height={16} />
                    </button>
                    <span className="w-9 text-center text-sm font-bold tabular-nums">
                      {formatNumber(line.quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuantity(line.variantId, line.quantity + 1)
                      }
                      disabled={maxQty > 0 && line.quantity >= maxQty}
                      className="flex h-full w-10 items-center justify-center text-muted transition-colors hover:text-fg disabled:opacity-40"
                      aria-label="افزایش تعداد"
                    >
                      <PlusIcon width={16} height={16} />
                    </button>
                  </div>

                  {!hasProblem && (
                    <span className="text-sm font-bold">
                      {formatToman(unitPrice * line.quantity)}
                    </span>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* خلاصه‌ی سفارش */}
      <div className="rounded-card border border-ink-800 bg-ink-900 p-5 lg:sticky lg:top-24">
        <h2 className="text-sm font-bold">خلاصه سفارش</h2>

        <dl className="mt-5 flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">جمع جزء</dt>
            <dd>{formatToman(subtotal)}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-accent-400">
              <dt>تخفیف</dt>
              <dd>− {formatToman(discount)}</dd>
            </div>
          )}
        </dl>

        <div className="mt-5 border-t border-ink-800 pt-5">
          <span className="mb-3 block text-xs font-bold text-muted">
            کد تخفیف
          </span>
          <CouponBox isLoggedIn={isLoggedIn} onChange={setAppliedCoupon} />
        </div>

        <div className="mt-5 flex items-baseline justify-between border-t border-ink-800 pt-5">
          <span className="text-sm font-bold">جمع کل</span>
          <span className="text-lg font-black text-accent-400">
            {formatToman(total)}
          </span>
        </div>

        <div className="mt-6">
          {problemRows.length > 0 ? (
            <p className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-xs leading-6 text-danger">
              برای ادامه، ابتدا کالاهای مشکل‌دار بالا را حذف کنید یا تعدادشان را
              کم کنید.
            </p>
          ) : (
            <ButtonLink href="/checkout" size="lg" className="w-full">
              ادامه به تسویه‌حساب
            </ButtonLink>
          )}
        </div>

        <Link
          href="/products"
          className="mt-4 block text-center text-xs text-muted hover:text-fg"
        >
          ادامه خرید
        </Link>
      </div>
    </div>
  );
}
