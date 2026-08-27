"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useCart, MAX_QTY_PER_ITEM } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/Button";
import { CheckIcon, ChevronDownIcon, MinusIcon, PlusIcon } from "@/components/ui/icons";
import { discountPercent, formatNumber, formatToman } from "@/lib/format";
import { cn } from "@/lib/cn";

export type VariantOption = {
  id: string;
  label: string;
  platform: string;
  region: string;
  capacity: string;
  price: number;
  compareAtPrice: number | null;
  stock: number;
};

const unique = (values: string[]) => [...new Set(values)];

export function VariantPicker({
  productSlug,
  productTitle,
  image,
  variants,
}: {
  productSlug: string;
  productTitle: string;
  image: string | null;
  variants: VariantOption[];
}) {
  const { add } = useCart();

  const platforms = useMemo(
    () => unique(variants.map((v) => v.platform)),
    [variants]
  );
  const [platform, setPlatform] = useState(platforms[0] ?? "");

  // ریجن‌های قابل انتخاب فقط از بین وردایانت‌های همان پلتفرم می‌آیند
  const regions = useMemo(
    () => unique(variants.filter((v) => v.platform === platform).map((v) => v.region)),
    [variants, platform]
  );
  const [regionState, setRegion] = useState(regions[0] ?? "");
  const region = regions.includes(regionState) ? regionState : (regions[0] ?? "");

  const capacities = useMemo(
    () =>
      unique(
        variants
          .filter((v) => v.platform === platform && v.region === region)
          .map((v) => v.capacity)
      ),
    [variants, platform, region]
  );
  const [capacityState, setCapacity] = useState(capacities[0] ?? "");
  const capacity = capacities.includes(capacityState)
    ? capacityState
    : (capacities[0] ?? "");

  const selected = useMemo(
    () =>
      variants.find(
        (v) =>
          v.platform === platform && v.region === region && v.capacity === capacity
      ) ?? null,
    [variants, platform, region, capacity]
  );

  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const maxQty = Math.min(MAX_QTY_PER_ITEM, selected?.stock ?? 0);
  const canAdd = Boolean(selected) && maxQty > 0;
  const off = selected
    ? discountPercent(selected.price, selected.compareAtPrice)
    : null;

  function handleAdd() {
    if (!selected || !canAdd) return;
    add(
      {
        variantId: selected.id,
        productSlug,
        title: productTitle,
        variantLabel: selected.label,
        image,
        price: selected.price,
      },
      Math.min(quantity, maxQty)
    );
    setAdded(true);
    window.setTimeout(() => setAdded(false), 4000);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* قیمت */}
      <div className="rounded-card border border-ink-800 bg-ink-900 p-5">
        {selected ? (
          <>
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-2xl font-black text-fg">
                {formatToman(selected.price)}
              </span>
              {off !== null && selected.compareAtPrice && (
                <>
                  <span className="text-sm text-muted line-through">
                    {formatToman(selected.compareAtPrice)}
                  </span>
                  <span className="rounded-lg bg-accent-400 px-2 py-0.5 text-xs font-bold text-ink-950">
                    ٪{off} تخفیف
                  </span>
                </>
              )}
            </div>
            <p className="mt-2 text-xs text-muted">
              {selected.stock > 0
                ? `موجود در انبار — ${formatNumber(selected.stock)} عدد`
                : "این ترکیب فعلاً موجود نیست"}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">ترکیب انتخابی موجود نیست.</p>
        )}
      </div>

      {/* انتخاب‌گرهای وابسته */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          label="پلتفرم"
          value={platform}
          options={platforms}
          onChange={(v) => {
            setPlatform(v);
            setQuantity(1);
          }}
        />
        <Select
          label="ریجن"
          value={region}
          options={regions}
          onChange={(v) => {
            setRegion(v);
            setQuantity(1);
          }}
        />
        <Select
          label="حجم / مدت"
          value={capacity}
          options={capacities}
          onChange={(v) => {
            setCapacity(v);
            setQuantity(1);
          }}
        />
      </div>

      {/* تعداد و افزودن به سبد */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex h-13 items-center rounded-xl border border-ink-700 bg-ink-900">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={!canAdd || quantity <= 1}
            className="flex h-full w-11 items-center justify-center text-muted transition-colors hover:text-fg disabled:opacity-40"
            aria-label="کاهش تعداد"
          >
            <MinusIcon width={18} height={18} />
          </button>
          <span className="w-10 text-center text-sm font-bold tabular-nums">
            {formatNumber(quantity)}
          </span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
            disabled={!canAdd || quantity >= maxQty}
            className="flex h-full w-11 items-center justify-center text-muted transition-colors hover:text-fg disabled:opacity-40"
            aria-label="افزایش تعداد"
          >
            <PlusIcon width={18} height={18} />
          </button>
        </div>

        <Button
          size="lg"
          onClick={handleAdd}
          disabled={!canAdd}
          className="flex-1 sm:flex-none"
        >
          {canAdd ? "افزودن به سبد خرید" : "ناموجود"}
        </Button>
      </div>

      {added && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-accent-400/40 bg-accent-400/10 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-accent-400">
            <CheckIcon width={18} height={18} />
            به سبد خرید اضافه شد
          </span>
          <Link
            href="/cart"
            className="shrink-0 text-sm font-bold text-accent-400 underline underline-offset-4"
          >
            مشاهده سبد
          </Link>
        </div>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const disabled = options.length <= 1;

  return (
    <label className="block">
      <span className="mb-2 block text-xs text-muted">{label}</span>
      <span className="relative block">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={options.length === 0}
          className={cn(
            "h-12 w-full appearance-none rounded-xl border border-ink-700 bg-ink-900 ps-4 pe-10 text-sm text-fg transition-colors",
            !disabled && "hover:border-ink-600",
            options.length === 0 && "opacity-50"
          )}
        >
          {options.length === 0 && <option value="">—</option>}
          {options.map((opt) => (
            <option key={opt} value={opt} className="bg-ink-900">
              {opt}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          width={18}
          height={18}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
        />
      </span>
    </label>
  );
}
