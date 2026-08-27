"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { CouponBox, type AppliedCoupon } from "@/components/cart/CouponBox";
import { OtpLoginForm } from "@/components/auth/OtpLoginForm";
import { Button, ButtonLink } from "@/components/ui/Button";
import { CheckIcon, ShieldIcon } from "@/components/ui/icons";
import {
  AddressFields,
  type AddressValue,
} from "@/components/form/AddressFields";
import { startCheckout } from "@/app/actions/checkout";
import { formatNumber, formatToman } from "@/lib/format";
import { cn } from "@/lib/cn";

type ServerItem = {
  variantId: string;
  title: string;
  variantLabel: string;
  price: number;
  stock: number;
  available: boolean;
};

export function CheckoutFlow({
  isLoggedIn,
  defaultFirstName,
  defaultLastName,
  defaultEmail,
  defaultAddress,
  gatewayIsMock,
}: {
  isLoggedIn: boolean;
  defaultFirstName: string;
  defaultLastName: string;
  defaultEmail: string;
  defaultAddress: AddressValue;
  gatewayIsMock: boolean;
}) {
  const router = useRouter();
  const { lines, ready, clear } = useCart();

  const [serverItems, setServerItems] = useState<ServerItem[]>([]);
  const [loadingCart, setLoadingCart] = useState(true);
  const [firstName, setFirstName] = useState(defaultFirstName);
  const [lastName, setLastName] = useState(defaultLastName);
  const [email, setEmail] = useState(defaultEmail);
  const [address, setAddress] = useState<AddressValue>(defaultAddress);
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const variantKey = lines.map((l) => l.variantId).sort().join(",");

  // قیمت‌های نمایشی این صفحه هم از سرور می‌آید تا با مبلغی که به درگاه
  // فرستاده می‌شود دقیقاً یکی باشد.
  useEffect(() => {
    if (!ready) return;
    if (lines.length === 0) {
      setServerItems([]);
      setLoadingCart(false);
      return;
    }

    let cancelled = false;
    setLoadingCart(true);

    fetch("/api/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantIds: lines.map((l) => l.variantId) }),
    })
      .then((r) => r.json())
      .then((data: { ok: boolean; items?: ServerItem[] }) => {
        if (!cancelled && data.ok && data.items) setServerItems(data.items);
      })
      .catch(() => undefined)
      .finally(() => !cancelled && setLoadingCart(false));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantKey, ready]);

  const rows = lines.map((line) => {
    const server = serverItems.find((s) => s.variantId === line.variantId);
    return {
      line,
      unitPrice: server?.price ?? line.price,
      title: server?.title ?? line.title,
      variantLabel: server?.variantLabel ?? line.variantLabel,
      ok: Boolean(server?.available) && (server?.stock ?? 0) >= line.quantity,
    };
  });

  const allOk = rows.length > 0 && rows.every((r) => r.ok);

  // بررسی سریع سمت مرورگر تا دکمه فعال/غیرفعال شود.
  // ⚠️ این جای اعتبارسنجی سرور را نمی‌گیرد؛ سرور دوباره همه را چک می‌کند.
  const addressMissing: string[] = [];
  if (!address.province) addressMissing.push("استان");
  if (!address.city) addressMissing.push("شهر");
  if (address.address.trim().length < 10) addressMissing.push("نشانی کامل");
  if (address.postalCode.length !== 10) addressMissing.push("کد پستی ۱۰ رقمی");
  const addressReady = addressMissing.length === 0;
  const subtotal = rows.reduce((sum, r) => sum + r.unitPrice * r.line.quantity, 0);
  const discount = coupon ? Math.min(coupon.amount, subtotal) : 0;
  const total = Math.max(0, subtotal - discount);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!allOk) {
      setError("سبد خرید شما مشکل دارد. به صفحه‌ی سبد برگردید و اصلاحش کنید.");
      return;
    }

    if (!addressReady) {
      setError(`برای ادامه این موارد را کامل کنید: ${addressMissing.join("، ")}`);
      return;
    }

    setBusy(true);
    try {
      const result = await startCheckout({
        firstName,
        lastName,
        email,
        ...address,
        discountCode: coupon?.code ?? null,
        items: lines.map((l) => ({
          variantId: l.variantId,
          quantity: l.quantity,
        })),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // سبد بعد از ساخته شدن سفارش خالی می‌شود؛ سفارش در دیتابیس ثبت شده
      // و پیگیری‌اش از پنل کاربری ممکن است.
      clear();

      if (result.paymentUrl.startsWith("/")) {
        router.push(result.paymentUrl);
      } else {
        window.location.href = result.paymentUrl;
      }
    } catch {
      setError("خطایی رخ داد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || loadingCart) {
    return (
      <div className="rounded-card border border-ink-800 p-12 text-center text-sm text-muted">
        در حال آماده‌سازی…
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-ink-700 p-14 text-center">
        <p className="text-base font-bold">سبد خرید شما خالی است</p>
        <p className="mt-2 text-sm text-muted">
          برای تسویه‌حساب، اول باید محصولی به سبد اضافه کنید.
        </p>
        <div className="mt-7 flex justify-center">
          <ButtonLink href="/products">رفتن به فروشگاه</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="flex flex-col gap-4">
        {/* مرحله ۱ — ورود */}
        <StepCard
          number={1}
          title="ورود با شماره موبایل"
          done={isLoggedIn}
          active={!isLoggedIn}
        >
          {isLoggedIn ? (
            <p className="text-sm text-muted">
              وارد شده‌اید. می‌توانید ادامه دهید.
            </p>
          ) : (
            <OtpLoginForm onSuccess={() => router.refresh()} />
          )}
        </StepCard>

        {/* مرحله ۲ — اطلاعات گیرنده */}
        <StepCard
          number={2}
          title="اطلاعات گیرنده و آدرس ارسال"
          done={false}
          active={isLoggedIn}
        >
          {isLoggedIn ? (
            <form onSubmit={submit} className="flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="نام">
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    maxLength={50}
                    required
                    className={inputClass}
                  />
                </Field>
                <Field label="نام خانوادگی">
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    maxLength={50}
                    required
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="ایمیل">
                <input
                  type="email"
                  dir="ltr"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={120}
                  required
                  placeholder="you@example.com"
                  className={cn(inputClass, "text-start")}
                />
                <p className="mt-2 text-xs text-muted">
                  کد خریداری‌شده به این ایمیل هم ارسال می‌شود.
                </p>
              </Field>

              {/* آدرس پستی — سفارش به همین نشانی ارسال می‌شود */}
              <div className="border-t border-ink-800 pt-5">
                <h3 className="mb-1 text-sm font-bold">آدرس ارسال سفارش</h3>
                <p className="mb-5 text-xs leading-6 text-muted">
                  بسته به این نشانی پست می‌شود. این آدرس در حساب شما ذخیره
                  می‌ماند تا خرید بعدی خودکار پر شود.
                </p>
                <AddressFields value={address} onChange={setAddress} />
              </div>

              {/* مرحله ۳ — روش پرداخت */}
              <div className="border-t border-ink-800 pt-5">
                <span className="mb-3 block text-sm font-bold">روش پرداخت</span>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-accent-400/50 bg-accent-400/5 p-4">
                  <input
                    type="radio"
                    name="gateway"
                    defaultChecked
                    className="h-4 w-4 accent-[var(--color-accent-400)]"
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-bold">
                      درگاه پرداخت زرین‌پال
                    </span>
                    <span className="mt-1 block text-xs text-muted">
                      {gatewayIsMock
                        ? "حالت تست — پول واقعی جابه‌جا نمی‌شود"
                        : "پرداخت امن با تمام کارت‌های عضو شتاب"}
                    </span>
                  </span>
                </label>
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm leading-6 text-danger"
                >
                  {error}
                </p>
              )}

              {!addressReady && !error && (
                <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-xs leading-6 text-warning">
                  برای فعال شدن دکمه‌ی پرداخت، این موارد را کامل کنید:{" "}
                  <strong>{addressMissing.join("، ")}</strong>
                </p>
              )}

              <Button
                type="submit"
                size="lg"
                disabled={busy || !allOk || !addressReady}
              >
                {busy ? "در حال انتقال به درگاه…" : "پرداخت و ثبت سفارش"}
              </Button>
            </form>
          ) : (
            <p className="text-sm text-muted">
              ابتدا مرحله‌ی قبل را کامل کنید.
            </p>
          )}
        </StepCard>
      </div>

      {/* خلاصه سفارش */}
      <div className="rounded-card border border-ink-800 bg-ink-900 p-5 lg:sticky lg:top-24">
        <h2 className="text-sm font-bold">خلاصه سفارش</h2>

        <ul className="mt-5 flex flex-col gap-4">
          {rows.map((row) => (
            <li key={row.line.variantId} className="flex flex-col gap-1">
              <div className="flex items-start justify-between gap-3">
                <span className="text-sm">{row.title}</span>
                <span className="shrink-0 text-sm">
                  {formatToman(row.unitPrice * row.line.quantity)}
                </span>
              </div>
              <span className="text-xs text-muted">
                {row.variantLabel} × {formatNumber(row.line.quantity)}
              </span>
              {!row.ok && (
                <span className="text-xs text-danger">
                  این کالا دیگر در دسترس نیست
                </span>
              )}
            </li>
          ))}
        </ul>

        <dl className="mt-5 flex flex-col gap-2 border-t border-ink-800 pt-5 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">جمع جزء</dt>
            <dd>{formatToman(subtotal)}</dd>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-accent-400">
              <dt>تخفیف ({coupon?.code})</dt>
              <dd>− {formatToman(discount)}</dd>
            </div>
          )}
        </dl>

        <div className="mt-5 border-t border-ink-800 pt-5">
          <span className="mb-3 block text-xs font-bold text-muted">
            کد تخفیف
          </span>
          <CouponBox isLoggedIn={isLoggedIn} onChange={setCoupon} />
        </div>

        <div className="mt-5 flex items-baseline justify-between border-t border-ink-800 pt-5">
          <span className="text-sm font-bold">مبلغ قابل پرداخت</span>
          <span className="text-lg font-black text-accent-400">
            {formatToman(total)}
          </span>
        </div>

        <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-muted">
          <ShieldIcon width={16} height={16} className="mt-0.5 shrink-0" />
          مبلغ نهایی روی سرور از روی قیمت‌های دیتابیس محاسبه می‌شود.
        </p>

        <Link
          href="/cart"
          className="mt-4 block text-center text-xs text-muted hover:text-fg"
        >
          ویرایش سبد خرید
        </Link>
      </div>
    </div>
  );
}

const inputClass =
  "h-12 w-full rounded-xl border border-ink-700 bg-ink-900 px-4 text-sm text-fg placeholder:text-muted/60 hover:border-ink-600";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-fg">{label}</span>
      {children}
    </label>
  );
}

function StepCard({
  number,
  title,
  done,
  active,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-card border bg-ink-900 p-5 sm:p-6",
        active ? "border-ink-600" : "border-ink-800"
      )}
    >
      <div className="mb-5 flex items-center gap-3">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black",
            done
              ? "bg-accent-400 text-ink-950"
              : active
                ? "bg-ink-800 text-accent-400"
                : "bg-ink-800 text-muted"
          )}
        >
          {done ? <CheckIcon width={18} height={18} /> : formatNumber(number)}
        </span>
        <h2 className="text-sm font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
