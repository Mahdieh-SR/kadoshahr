"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";

const options = [
  { value: "newest", label: "جدیدترین" },
  { value: "bestselling", label: "پرفروش‌ترین" },
  { value: "price-asc", label: "ارزان‌ترین" },
  { value: "price-desc", label: "گران‌ترین" },
];

export function SortSelect() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const current = searchParams.get("sort") ?? "newest";

  function onChange(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "newest") next.delete("sort");
    else next.set("sort", value);
    startTransition(() => {
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  return (
    <label className="relative shrink-0">
      <span className="sr-only">مرتب‌سازی</span>
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 appearance-none rounded-xl border border-ink-700 bg-ink-900 ps-4 pe-10 text-sm text-fg hover:border-ink-600"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-ink-900">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        width={18}
        height={18}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
      />
    </label>
  );
}
