"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteProduct, saveProduct } from "@/app/actions/admin";
import { Button } from "@/components/ui/Button";
import {
  ChevronDownIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/ui/icons";
import { formatNumber, toLatinDigits } from "@/lib/format";

export type VariantDraft = {
  id?: string;
  platform: string;
  region: string;
  capacity: string;
  price: string;
  compareAtPrice: string;
  stock: string;
  isActive: boolean;
};

export type ProductDraft = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  categoryId: string;
  images: string[];
  isActive: boolean;
  isFeatured: boolean;
  specs: { key: string; value: string }[];
  variants: VariantDraft[];
};

export const emptyVariant: VariantDraft = {
  platform: "",
  region: "",
  capacity: "",
  price: "",
  compareAtPrice: "",
  stock: "0",
  isActive: true,
};

const digits = (v: string) => toLatinDigits(v).replace(/\D/g, "");

export function ProductForm({
  initial,
  categories,
}: {
  initial: ProductDraft;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ProductDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isNew = !draft.id;

  function set<K extends keyof ProductDraft>(key: K, value: ProductDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  function setVariant(index: number, patch: Partial<VariantDraft>) {
    setDraft((d) => ({
      ...d,
      variants: d.variants.map((v, i) => (i === index ? { ...v, ...patch } : v)),
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    // اعداد به عدد واقعی تبدیل می‌شوند؛ سرور دوباره همه را اعتبارسنجی می‌کند
    const payload = {
      ...(draft.id ? { id: draft.id } : {}),
      title: draft.title,
      slug: draft.slug,
      description: draft.description,
      categoryId: draft.categoryId,
      images: draft.images.filter((i) => i.trim()),
      isActive: draft.isActive,
      isFeatured: draft.isFeatured,
      specs: draft.specs.filter((s) => s.key.trim() && s.value.trim()),
      variants: draft.variants.map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        label: `${v.platform} — ${v.region} — ${v.capacity}`,
        platform: v.platform,
        region: v.region,
        capacity: v.capacity,
        price: Number(digits(v.price) || 0),
        compareAtPrice: v.compareAtPrice ? Number(digits(v.compareAtPrice)) : null,
        stock: Number(digits(v.stock) || 0),
        isActive: v.isActive,
      })),
    };

    try {
      const result = await saveProduct(payload);
      if (!result.ok) {
        setError(result.error ?? "ذخیره نشد.");
        return;
      }
      setMessage(result.message ?? "ذخیره شد.");
      if (isNew && result.id) {
        router.push(`/admin/products/${result.id}`);
      }
      router.refresh();
    } catch {
      setError("خطایی رخ داد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!draft.id) return;
    if (!window.confirm("از حذف این محصول مطمئن هستید؟")) return;

    setBusy(true);
    setError(null);
    try {
      const result = await deleteProduct(draft.id);
      if (!result.ok) {
        setError(result.error ?? "حذف نشد.");
        return;
      }
      window.alert(result.message ?? "حذف شد.");
      router.push("/admin/products");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {/* ── اطلاعات پایه ── */}
      <Card title="اطلاعات محصول">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="عنوان محصول">
            <input
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              maxLength={120}
              required
              placeholder="مثلاً: گیفت‌کارت پلی‌استیشن"
              className={input}
            />
          </Field>

          <Field label="نشانی صفحه (انگلیسی)">
            <input
              value={draft.slug}
              onChange={(e) =>
                set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
              }
              dir="ltr"
              maxLength={120}
              required
              placeholder="playstation-gift-card"
              className={`${input} text-start`}
            />
            <p className="mt-2 text-[11px] text-muted">
              آدرس محصول: /product/<strong>{draft.slug || "…"}</strong>
            </p>
          </Field>
        </div>

        <Field label="دسته‌بندی">
          <span className="relative block">
            <select
              value={draft.categoryId}
              onChange={(e) => set("categoryId", e.target.value)}
              required
              className={`${input} appearance-none ps-4 pe-10`}
            >
              <option value="">انتخاب دسته‌بندی</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id} className="bg-ink-900">
                  {c.name}
                </option>
              ))}
            </select>
            <ChevronDownIcon
              width={18}
              height={18}
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
            />
          </span>
        </Field>

        <Field label="توضیحات">
          <textarea
            value={draft.description}
            onChange={(e) => set("description", e.target.value)}
            rows={5}
            maxLength={5000}
            required
            placeholder="توضیح کوتاه و مفید درباره‌ی این محصول…"
            className="w-full resize-y rounded-xl border border-ink-700 bg-ink-950 p-4 text-sm leading-7 text-fg placeholder:text-muted/60 hover:border-ink-600"
          />
        </Field>

        <div className="flex flex-wrap gap-6">
          <Toggle
            label="فعال (در فروشگاه دیده شود)"
            checked={draft.isActive}
            onChange={(v) => set("isActive", v)}
          />
          <Toggle
            label="نمایش در «پرفروش‌ترین‌ها»"
            checked={draft.isFeatured}
            onChange={(v) => set("isFeatured", v)}
          />
        </div>
      </Card>

      {/* ── تصاویر ── */}
      <Card title="تصاویر">
        <p className="mb-4 text-xs leading-6 text-muted">
          آدرس تصویر را وارد کنید. می‌تواند فایل داخل پوشه‌ی public باشد (مثل{" "}
          <code dir="ltr">/products/steam-1.svg</code>) یا لینک کامل اینترنتی.
          تصویر اول، تصویر اصلی کارت محصول است.
        </p>

        <div className="flex flex-col gap-3">
          {draft.images.map((img, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="h-14 w-16 shrink-0 overflow-hidden rounded-lg border border-ink-700 bg-ink-950">
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt="" className="h-full w-full object-cover" />
                )}
              </span>
              <input
                value={img}
                dir="ltr"
                onChange={(e) =>
                  set(
                    "images",
                    draft.images.map((v, idx) => (idx === i ? e.target.value : v))
                  )
                }
                placeholder="/products/example.svg"
                className={`${input} text-start`}
              />
              <IconButton
                label="حذف تصویر"
                onClick={() =>
                  set("images", draft.images.filter((_, idx) => idx !== i))
                }
              />
            </div>
          ))}
        </div>

        <AddButton
          label="افزودن تصویر"
          disabled={draft.images.length >= 8}
          onClick={() => set("images", [...draft.images, ""])}
        />
      </Card>

      {/* ── مشخصات فنی ── */}
      <Card title="مشخصات فنی">
        <p className="mb-4 text-xs text-muted">
          در تب «مشخصات فنی» صفحه‌ی محصول نمایش داده می‌شود.
        </p>

        <div className="flex flex-col gap-3">
          {draft.specs.map((spec, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                value={spec.key}
                onChange={(e) =>
                  set(
                    "specs",
                    draft.specs.map((s, idx) =>
                      idx === i ? { ...s, key: e.target.value } : s
                    )
                  )
                }
                placeholder="عنوان (مثلاً: زمان تحویل)"
                className={`${input} sm:max-w-56`}
              />
              <input
                value={spec.value}
                onChange={(e) =>
                  set(
                    "specs",
                    draft.specs.map((s, idx) =>
                      idx === i ? { ...s, value: e.target.value } : s
                    )
                  )
                }
                placeholder="مقدار (مثلاً: بین ۵ تا ۳۰ دقیقه)"
                className={input}
              />
              <IconButton
                label="حذف مشخصه"
                onClick={() =>
                  set("specs", draft.specs.filter((_, idx) => idx !== i))
                }
              />
            </div>
          ))}
        </div>

        <AddButton
          label="افزودن مشخصه"
          disabled={draft.specs.length >= 20}
          onClick={() => set("specs", [...draft.specs, { key: "", value: "" }])}
        />
      </Card>

      {/* ── وردایانت‌ها ── */}
      <Card title="نسخه‌ها و قیمت‌ها">
        <p className="mb-4 text-xs leading-6 text-muted">
          هر ترکیب پلتفرم / ریجن / حجم یک نسخه‌ی جداست و قیمت و موجودی مستقل
          دارد. همین‌ها در صفحه‌ی محصول به‌صورت سه dropdown نمایش داده می‌شوند.
        </p>

        <div className="flex flex-col gap-4">
          {draft.variants.map((variant, i) => (
            <div
              key={variant.id ?? `new-${i}`}
              className="rounded-xl border border-ink-700 bg-ink-950 p-4"
            >
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-xs font-bold text-muted">
                  نسخه {formatNumber(i + 1)}
                  {variant.id ? "" : " (جدید)"}
                </span>
                <div className="flex items-center gap-3">
                  <Toggle
                    label="فعال"
                    checked={variant.isActive}
                    onChange={(v) => setVariant(i, { isActive: v })}
                  />
                  {draft.variants.length > 1 && (
                    <IconButton
                      label="حذف نسخه"
                      onClick={() =>
                        set(
                          "variants",
                          draft.variants.filter((_, idx) => idx !== i)
                        )
                      }
                    />
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="پلتفرم" small>
                  <input
                    value={variant.platform}
                    onChange={(e) => setVariant(i, { platform: e.target.value })}
                    required
                    maxLength={40}
                    placeholder="PlayStation"
                    className={input}
                  />
                </Field>
                <Field label="ریجن" small>
                  <input
                    value={variant.region}
                    onChange={(e) => setVariant(i, { region: e.target.value })}
                    required
                    maxLength={40}
                    placeholder="آمریکا"
                    className={input}
                  />
                </Field>
                <Field label="حجم / مدت" small>
                  <input
                    value={variant.capacity}
                    onChange={(e) => setVariant(i, { capacity: e.target.value })}
                    required
                    maxLength={40}
                    placeholder="۵۰ دلاری"
                    className={input}
                  />
                </Field>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="قیمت (تومان)" small>
                  <input
                    value={variant.price ? formatNumber(Number(variant.price)) : ""}
                    onChange={(e) => setVariant(i, { price: digits(e.target.value) })}
                    inputMode="numeric"
                    required
                    placeholder="۳٬۸۰۰٬۰۰۰"
                    className={input}
                  />
                </Field>
                <Field label="قیمت قبل از تخفیف" small>
                  <input
                    value={
                      variant.compareAtPrice
                        ? formatNumber(Number(variant.compareAtPrice))
                        : ""
                    }
                    onChange={(e) =>
                      setVariant(i, { compareAtPrice: digits(e.target.value) })
                    }
                    inputMode="numeric"
                    placeholder="اختیاری"
                    className={input}
                  />
                </Field>
                <Field label="موجودی" small>
                  <input
                    value={variant.stock ? formatNumber(Number(variant.stock)) : "۰"}
                    onChange={(e) => setVariant(i, { stock: digits(e.target.value) })}
                    inputMode="numeric"
                    className={input}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>

        <AddButton
          label="افزودن نسخه"
          disabled={draft.variants.length >= 40}
          onClick={() => set("variants", [...draft.variants, { ...emptyVariant }])}
        />
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
          {busy ? "در حال ذخیره…" : isNew ? "ساخت محصول" : "ذخیره تغییرات"}
        </Button>

        {!isNew && (
          <Button type="button" variant="danger" onClick={remove} disabled={busy}>
            حذف محصول
          </Button>
        )}
      </div>
    </form>
  );
}

const input =
  "h-12 w-full rounded-xl border border-ink-700 bg-ink-950 px-4 text-sm text-fg placeholder:text-muted/60 hover:border-ink-600";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-ink-800 bg-ink-900 p-5 sm:p-6">
      <h2 className="mb-5 text-sm font-bold">{title}</h2>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

function Field({
  label,
  small,
  children,
}: {
  label: string;
  small?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className={
          small
            ? "mb-2 block text-[11px] text-muted"
            : "mb-2 block text-sm font-bold text-fg"
        }
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted hover:text-fg">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-[var(--color-accent-400)]"
      />
      {label}
    </label>
  );
}

function IconButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
    >
      <TrashIcon width={18} height={18} />
    </button>
  );
}

function AddButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="mt-4 inline-flex items-center gap-2 self-start rounded-xl border border-dashed border-ink-600 px-4 py-2.5 text-xs text-muted transition-colors hover:border-accent-400 hover:text-accent-400 disabled:opacity-40"
    >
      <PlusIcon width={16} height={16} />
      {label}
    </button>
  );
}
