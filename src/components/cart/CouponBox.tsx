"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "./CartProvider";
import { CheckIcon, CloseIcon } from "@/components/ui/icons";
import { formatToman } from "@/lib/format";

export type AppliedCoupon = {
  code: string;
  label: string;
  amount: number;
};

type ApiResponse = {
  ok: boolean;
  error?: string;
  code?: string;
  label?: string;
  amount?: number;
};

/**
 * کادر کد تخفیف.
 *
 * ⚠️ مبلغی که اینجا نمایش داده می‌شود فقط «پیش‌نمایش» است. مبلغ واقعی سفارش
 * هنگام ثبت، دوباره سمت سرور از روی دیتابیس محاسبه می‌شود.
 */
export function CouponBox({
  isLoggedIn,
  onChange,
}: {
  isLoggedIn: boolean;
  /** هر بار که تخفیف اعمال یا حذف شد، والد را خبر می‌کند */
  onChange: (coupon: AppliedCoupon | null) => void;
}) {
  const { lines, coupon, setCoupon, ready } = useCart();

  const [input, setInput] = useState(coupon);
  const [applied, setApplied] = useState<AppliedCoupon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autoChecked = useRef(false);

  const itemsKey = lines
    .map((l) => `${l.variantId}:${l.quantity}`)
    .sort()
    .join(",");

  async function check(rawCode: string, silent = false) {
    if (!rawCode.trim()) return;

    setBusy(true);
    if (!silent) setError(null);

    try {
      const res = await fetch("/api/discount", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: rawCode,
          items: lines.map((l) => ({
            variantId: l.variantId,
            quantity: l.quantity,
          })),
        }),
      });
      const data: ApiResponse = await res.json();

      if (data.ok && data.code && data.amount) {
        const next = {
          code: data.code,
          label: data.label ?? "تخفیف",
          amount: data.amount,
        };
        setApplied(next);
        setCoupon(data.code);
        setInput(data.code);
        setError(null);
        onChange(next);
      } else {
        setApplied(null);
        onChange(null);
        // در بررسی خودکار، اگر کد دیگر معتبر نبود بی‌سروصدا برداشته می‌شود
        if (!silent) setError(data.error ?? "این کد تخفیف معتبر نیست.");
        else setCoupon("");
      }
    } catch {
      if (!silent) setError("ارتباط با سرور برقرار نشد.");
    } finally {
      setBusy(false);
    }
  }

  // اگر کد از قبل ذخیره شده بود، یک بار خودکار بررسی می‌شود
  useEffect(() => {
    if (!ready || autoChecked.current || !coupon || !isLoggedIn) return;
    if (lines.length === 0) return;
    autoChecked.current = true;
    void check(coupon, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, coupon, isLoggedIn, lines.length]);

  // اگر سبد عوض شد، تخفیف دوباره حساب می‌شود (مثلاً حداقل مبلغ دیگر برقرار نباشد)
  useEffect(() => {
    if (!applied) return;
    void check(applied.code, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  function removeCoupon() {
    setApplied(null);
    setCoupon("");
    setInput("");
    setError(null);
    onChange(null);
  }

  if (!isLoggedIn) {
    return (
      <p className="rounded-xl border border-ink-700 bg-ink-950 px-4 py-3 text-xs leading-6 text-muted">
        برای استفاده از کد تخفیف، ابتدا وارد حساب خود شوید.
      </p>
    );
  }

  if (applied) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-accent-400/40 bg-accent-400/10 px-4 py-3">
        <span className="flex min-w-0 items-center gap-2 text-sm text-accent-400">
          <CheckIcon width={16} height={16} className="shrink-0" />
          <span className="min-w-0">
            <span dir="ltr" className="block truncate font-bold">
              {applied.code}
            </span>
            <span className="block text-[11px]">
              {applied.label} — {formatToman(applied.amount)}
            </span>
          </span>
        </span>

        <button
          type="button"
          onClick={removeCoupon}
          aria-label="حذف کد تخفیف"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <CloseIcon width={16} height={16} />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void check(input);
            }
          }}
          dir="ltr"
          maxLength={32}
          placeholder="کد تخفیف"
          className="h-11 w-full rounded-xl border border-ink-700 bg-ink-950 px-3 text-start text-sm tracking-wide text-fg placeholder:text-end placeholder:tracking-normal placeholder:text-muted/60 hover:border-ink-600"
        />
        <button
          type="button"
          onClick={() => void check(input)}
          disabled={busy || !input.trim()}
          className="h-11 shrink-0 rounded-xl border border-ink-600 px-4 text-xs font-bold text-fg transition-colors hover:border-accent-400 hover:text-accent-400 disabled:opacity-40"
        >
          {busy ? "…" : "اعمال"}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs leading-6 text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
