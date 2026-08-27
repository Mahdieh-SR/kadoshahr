"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteDiscount, saveDiscount } from "@/app/actions/admin";
import { Button } from "@/components/ui/Button";
import { ChevronDownIcon } from "@/components/ui/icons";
import { formatNumber, toLatinDigits } from "@/lib/format";

export type DiscountDraft = {
  id?: string;
  code: string;
  type: "PERCENT" | "FIXED";
  value: string;
  minOrderAmount: string;
  maxDiscountAmount: string;
  usageLimit: string;
  perUserLimit: string;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
  description: string;
};

export const emptyDiscount: DiscountDraft = {
  code: "",
  type: "PERCENT",
  value: "10",
  minOrderAmount: "0",
  maxDiscountAmount: "0",
  usageLimit: "0",
  perUserLimit: "1",
  startsAt: "",
  expiresAt: "",
  isActive: true,
  description: "",
};

const digits = (v: string) => toLatinDigits(v).replace(/\D/g, "");

export function DiscountForm({
  initial,
  usedCount = 0,
}: {
  initial: DiscountDraft;
  usedCount?: number;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<DiscountDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isNew = !draft.id;
  const isPercent = draft.type === "PERCENT";

  function set<K extends keyof DiscountDraft>(key: K, value: DiscountDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const result = await saveDiscount({
        ...(draft.id ? { id: draft.id } : {}),
        code: draft.code,
        type: draft.type,
        value: Number(digits(draft.value) || 0),
        minOrderAmount: Number(digits(draft.minOrderAmount) || 0),
        maxDiscountAmount: Number(digits(draft.maxDiscountAmount) || 0),
        usageLimit: Number(digits(draft.usageLimit) || 0),
        perUserLimit: Number(digits(draft.perUserLimit) || 0),
        startsAt: draft.startsAt || null,
        expiresAt: draft.expiresAt || null,
        isActive: draft.isActive,
        description: draft.description,
      });

      if (!result.ok) {
        setError(result.error ?? "ذخیره نشد.");
        return;
      }

      setMessage(result.message ?? "ذخیره شد.");
      if (isNew && result.id) router.push(`/admin/discounts/${result.id}`);
      router.refresh();
    } catch {
      setError("خطایی رخ داد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!draft.id) return;
    if (!window.confirm("از حذف این کد تخفیف مطمئن هستید؟")) return;

    setBusy(true);
    try {
      const result = await deleteDiscount(draft.id);
      if (!result.ok) {
        setError(result.error ?? "حذف نشد.");
        return;
      }
      window.alert(result.message ?? "حذف شد.");
      router.push("/admin/discounts");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-2xl flex-col gap-6">
      <Card title="کد و نوع تخفیف">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="کد تخفیف">
            <input
              value={draft.code}
              onChange={(e) =>
                set("code", e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))
              }
              dir="ltr"
              maxLength={32}
              required
              placeholder="NOWRUZ1404"
              className={`${input} text-start tracking-wider`}
            />
            <p className="mt-2 text-[11px] text-muted">
              فقط حروف انگلیسی، عدد، خط تیره و زیرخط.
            </p>
          </Field>

          <Field label="نوع تخفیف">
            <span className="relative block">
              <select
                value={draft.type}
                onChange={(e) =>
                  set("type", e.target.value as DiscountDraft["type"])
                }
                className={`${input} appearance-none ps-4 pe-10`}
              >
                <option value="PERCENT" className="bg-ink-900">
                  درصدی
                </option>
                <option value="FIXED" className="bg-ink-900">
                  مبلغ ثابت (تومان)
                </option>
              </select>
              <ChevronDownIcon
                width={18}
                height={18}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
              />
            </span>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={isPercent ? "درصد تخفیف" : "مبلغ تخفیف (تومان)"}>
            <input
              value={
                draft.value
                  ? isPercent
                    ? draft.value
                    : formatNumber(Number(draft.value))
                  : ""
              }
              onChange={(e) => set("value", digits(e.target.value))}
              inputMode="numeric"
              required
              placeholder={isPercent ? "۲۰" : "۵۰۰٬۰۰۰"}
              className={input}
            />
            <p className="mt-2 text-[11px] text-muted">
              {isPercent
                ? "عددی بین ۱ تا ۱۰۰"
                : "این مبلغ از جمع سبد کم می‌شود"}
            </p>
          </Field>

          {isPercent && (
            <Field label="سقف تخفیف (تومان)">
              <input
                value={
                  draft.maxDiscountAmount
                    ? formatNumber(Number(draft.maxDiscountAmount))
                    : ""
                }
                onChange={(e) =>
                  set("maxDiscountAmount", digits(e.target.value))
                }
                inputMode="numeric"
                placeholder="۰ = بدون سقف"
                className={input}
              />
              <p className="mt-2 text-[11px] leading-5 text-muted">
                مثلاً «۲۰٪ تا سقف ۵۰۰ هزار تومان». صفر یعنی بدون سقف.
              </p>
            </Field>
          )}
        </div>

        <Field label="توضیح کوتاه (اختیاری)">
          <input
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            maxLength={200}
            placeholder="مثلاً: جشنواره نوروز"
            className={input}
          />
        </Field>
      </Card>

      <Card title="شرایط استفاده">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="حداقل مبلغ سبد (تومان)">
            <input
              value={
                draft.minOrderAmount
                  ? formatNumber(Number(draft.minOrderAmount))
                  : ""
              }
              onChange={(e) => set("minOrderAmount", digits(e.target.value))}
              inputMode="numeric"
              placeholder="۰ = بدون محدودیت"
              className={input}
            />
          </Field>

          <Field label="سقف کل استفاده">
            <input
              value={
                draft.usageLimit ? formatNumber(Number(draft.usageLimit)) : ""
              }
              onChange={(e) => set("usageLimit", digits(e.target.value))}
              inputMode="numeric"
              placeholder="۰ = نامحدود"
              className={input}
            />
            {!isNew && (
              <p className="mt-2 text-[11px] text-muted">
                تا الان {formatNumber(usedCount)} بار استفاده شده.
              </p>
            )}
          </Field>

          <Field label="سقف استفاده هر کاربر">
            <input
              value={
                draft.perUserLimit
                  ? formatNumber(Number(draft.perUserLimit))
                  : ""
              }
              onChange={(e) => set("perUserLimit", digits(e.target.value))}
              inputMode="numeric"
              placeholder="۱"
              className={input}
            />
            <p className="mt-2 text-[11px] text-muted">۰ یعنی نامحدود</p>
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="شروع اعتبار (اختیاری)">
            <input
              type="datetime-local"
              value={draft.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
              className={`${input} text-start`}
            />
          </Field>

          <Field label="پایان اعتبار (اختیاری)">
            <input
              type="datetime-local"
              value={draft.expiresAt}
              onChange={(e) => set("expiresAt", e.target.value)}
              className={`${input} text-start`}
            />
          </Field>
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted hover:text-fg">
          <input
            type="checkbox"
            checked={draft.isActive}
            onChange={(e) => set("isActive", e.target.checked)}
            className="h-4 w-4 accent-[var(--color-accent-400)]"
          />
          فعال (قابل استفاده توسط مشتری)
        </label>
      </Card>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm leading-6 text-danger"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
        >
          {message}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="lg" disabled={busy}>
          {busy ? "در حال ذخیره…" : isNew ? "ساخت کد تخفیف" : "ذخیره تغییرات"}
        </Button>

        {!isNew && (
          <Button type="button" variant="danger" onClick={remove} disabled={busy}>
            حذف کد
          </Button>
        )}
      </div>
    </form>
  );
}

const input =
  "h-12 w-full rounded-xl border border-ink-700 bg-ink-950 px-4 text-sm text-fg placeholder:text-muted/60 hover:border-ink-600";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-card border border-ink-800 bg-ink-900 p-5 sm:p-6">
      <h2 className="mb-5 text-sm font-bold">{title}</h2>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

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
