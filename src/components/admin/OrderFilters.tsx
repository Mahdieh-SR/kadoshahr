"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/cn";

const tabs = [
  { value: "", label: "همه" },
  { value: "PAID", label: ORDER_STATUS_LABELS.PAID },
  { value: "DELIVERED", label: ORDER_STATUS_LABELS.DELIVERED },
  { value: "PENDING_PAYMENT", label: ORDER_STATUS_LABELS.PENDING_PAYMENT },
  { value: "FAILED", label: ORDER_STATUS_LABELS.FAILED },
  { value: "CANCELLED", label: ORDER_STATUS_LABELS.CANCELLED },
];

export function OrderFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentStatus = searchParams.get("status") ?? "";
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const firstRender = useRef(true);

  // جستجوی زنده روی کد سفارش، نام و شماره مشتری
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const timer = window.setTimeout(() => {
      const next = new URLSearchParams();
      if (currentStatus) next.set("status", currentStatus);
      const trimmed = query.trim();
      if (trimmed) next.set("q", trimmed);

      if (next.toString() !== searchParams.toString()) {
        startTransition(() => {
          const qs = next.toString();
          router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
        });
      }
    }, 350);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function statusHref(value: string) {
    const next = new URLSearchParams();
    if (value) next.set("status", value);
    const trimmed = query.trim();
    if (trimmed) next.set("q", trimmed);
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div className="flex flex-col gap-4">
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
          placeholder="جستجوی کد سفارش، نام یا شماره موبایل مشتری…"
          className="h-12 w-full rounded-xl border border-ink-700 bg-ink-900 pe-4 ps-12 text-sm text-fg placeholder:text-muted/70 hover:border-ink-600"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <Link
            key={tab.value || "all"}
            href={statusHref(tab.value)}
            scroll={false}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-xs transition-colors",
              currentStatus === tab.value
                ? "border-accent-400 bg-accent-400/10 font-bold text-accent-400"
                : "border-ink-700 text-muted hover:border-ink-600 hover:text-fg"
            )}
          >
            {tab.label}
          </Link>
        ))}

        <span
          className={cn(
            "text-xs text-accent-400 transition-opacity",
            isPending ? "opacity-100" : "opacity-0"
          )}
        >
          در حال به‌روزرسانی…
        </span>
      </div>
    </div>
  );
}
