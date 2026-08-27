"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { formatNumber, toLatinDigits } from "@/lib/format";
import { cn } from "@/lib/cn";

export type Facets = {
  regions: string[];
  platforms: string[];
  minPrice: number;
  maxPrice: number;
};

const digitsOnly = (raw: string) => toLatinDigits(raw).replace(/\D/g, "");

/**
 * فیلترها و جستجو، وضعیت‌شان را در آدرس صفحه (query string) نگه می‌دارند.
 * مزیتش این است که لینک نتیجه‌ی فیلترشده قابل اشتراک‌گذاری و قابل bookmark است
 * و دکمه‌ی back مرورگر هم درست کار می‌کند.
 */
export function ProductFilters({ facets }: { facets: Facets }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // ورودی‌های متنی کنترل‌شده‌اند تا هم زنده عمل کنند و هم دکمه‌ی «پاک کردن»
  // بتواند خالی‌شان کند.
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [minInput, setMinInput] = useState(searchParams.get("min") ?? "");
  const [maxInput, setMaxInput] = useState(searchParams.get("max") ?? "");
  const firstRender = useRef(true);

  const selectedRegions = searchParams.getAll("region");
  const selectedPlatforms = searchParams.getAll("platform");

  /**
   * آدرس جدید را همیشه از روی «وضعیت فعلی همه‌ی فیلترها» می‌سازد.
   * اگر هر فیلتر جدا فقط پارامتر خودش را به آدرس اضافه می‌کرد، تغییرات هم‌زمان
   * (مثلاً تایپ در جستجو هم‌زمان با تیک زدن ریجن) همدیگر را پاک می‌کردند.
   */
  function buildParams(overrides?: {
    regions?: string[];
    platforms?: string[];
  }): URLSearchParams {
    const next = new URLSearchParams();

    const sort = searchParams.get("sort");
    if (sort) next.set("sort", sort);

    for (const r of overrides?.regions ?? selectedRegions) next.append("region", r);
    for (const p of overrides?.platforms ?? selectedPlatforms)
      next.append("platform", p);

    const q = query.trim();
    if (q) next.set("q", q);

    const min = digitsOnly(minInput);
    if (min) next.set("min", min);

    const max = digitsOnly(maxInput);
    if (max) next.set("max", max);

    return next;
  }

  function push(next: URLSearchParams) {
    startTransition(() => {
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  // جستجو و بازه‌ی قیمت هر دو زنده‌اند: ۳۵۰ میلی‌ثانیه بعد از توقف تایپ،
  // نتیجه بدون زدن Enter و بدون کلیک بیرون کادر به‌روز می‌شود.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      const next = buildParams();
      if (next.toString() !== searchParams.toString()) push(next);
    }, 350);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, minInput, maxInput]);

  function toggleMulti(key: "region" | "platform", value: string) {
    const current = key === "region" ? selectedRegions : selectedPlatforms;
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];

    push(
      buildParams(key === "region" ? { regions: updated } : { platforms: updated })
    );
  }

  function clearAll() {
    setQuery("");
    setMinInput("");
    setMaxInput("");
    const next = new URLSearchParams();
    const sort = searchParams.get("sort");
    if (sort) next.set("sort", sort);
    push(next);
  }

  const hasFilters =
    selectedRegions.length > 0 ||
    selectedPlatforms.length > 0 ||
    Boolean(query || minInput || maxInput);

  return (
    <aside className="flex flex-col gap-7">
      {/* جستجوی زنده */}
      <div>
        <label className="relative block">
          <SearchIcon
            width={18}
            height={18}
            className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="نام محصول، پلتفرم یا ریجن…"
            className="h-12 w-full rounded-xl border border-ink-700 bg-ink-900 pe-4 ps-12 text-sm text-fg placeholder:text-muted/70 hover:border-ink-600"
          />
        </label>
        <p
          className={cn(
            "mt-2 h-4 text-xs text-accent-400 transition-opacity",
            isPending ? "opacity-100" : "opacity-0"
          )}
        >
          در حال به‌روزرسانی نتایج…
        </p>
      </div>

      {facets.platforms.length > 1 && (
        <FilterGroup title="پلتفرم">
          {facets.platforms.map((p) => (
            <CheckboxRow
              key={p}
              label={p}
              checked={selectedPlatforms.includes(p)}
              onChange={() => toggleMulti("platform", p)}
            />
          ))}
        </FilterGroup>
      )}

      {facets.regions.length > 1 && (
        <FilterGroup title="ریجن">
          {facets.regions.map((r) => (
            <CheckboxRow
              key={r}
              label={r}
              checked={selectedRegions.includes(r)}
              onChange={() => toggleMulti("region", r)}
            />
          ))}
        </FilterGroup>
      )}

      <FilterGroup title="بازه قیمت (تومان)">
        <div className="flex items-center gap-2">
          <PriceInput
            placeholder="از"
            value={minInput}
            onChange={setMinInput}
            aria-label="حداقل قیمت"
          />
          <span className="text-muted">—</span>
          <PriceInput
            placeholder="تا"
            value={maxInput}
            onChange={setMaxInput}
            aria-label="حداکثر قیمت"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {buildPriceShortcuts(facets).map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                setMinInput(s.min);
                setMaxInput(s.max);
              }}
              className="rounded-lg border border-ink-700 px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-accent-400 hover:text-accent-400"
            >
              {s.label}
            </button>
          ))}
        </div>

        <p className="text-[11px] leading-5 text-muted">
          قیمت‌های موجود از {formatNumber(facets.minPrice)} تا{" "}
          {formatNumber(facets.maxPrice)} تومان
        </p>
      </FilterGroup>

      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="self-start text-sm text-accent-400 underline underline-offset-4"
        >
          پاک کردن همه فیلترها
        </button>
      )}
    </aside>
  );
}

/** چند بازه‌ی آماده تا کاربر مجبور نباشد عدد تایپ کند */
function buildPriceShortcuts(facets: Facets) {
  return [
    { label: "زیر ۱ میلیون", min: "", max: "1000000" },
    { label: "۱ تا ۳ میلیون", min: "1000000", max: "3000000" },
    { label: "۳ تا ۸ میلیون", min: "3000000", max: "8000000" },
    { label: "همه", min: "", max: "" },
  ].filter((s) => !s.min || Number(s.min) <= facets.maxPrice);
}

function PriceInput({
  value,
  onChange,
  placeholder,
  ...rest
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
} & React.AriaAttributes) {
  return (
    <input
      inputMode="numeric"
      value={value ? formatNumber(Number(value)) : ""}
      onChange={(e) => onChange(digitsOnly(e.target.value))}
      placeholder={placeholder}
      className="h-11 w-full rounded-xl border border-ink-700 bg-ink-900 px-3 text-sm text-fg placeholder:text-muted/70 hover:border-ink-600"
      {...rest}
    />
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-ink-800 pt-6">
      <h3 className="text-sm font-bold">{title}</h3>
      {children}
    </div>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 text-sm text-muted hover:text-fg">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 accent-[var(--color-accent-400)]"
      />
      {label}
    </label>
  );
}
