"use client";

import { useState } from "react";
import type { ProductSpec } from "@/lib/products";
import { cn } from "@/lib/cn";

type TabKey = "description" | "specs" | "reviews";

export function ProductTabs({
  description,
  specs,
  reviewCount,
  reviewsSlot,
}: {
  description: string;
  specs: ProductSpec[];
  reviewCount: number;
  /** پنل نظرها که از صفحه‌ی محصول پاس داده می‌شود */
  reviewsSlot: React.ReactNode;
}) {
  const [tab, setTab] = useState<TabKey>("description");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "description", label: "توضیحات" },
    { key: "specs", label: "مشخصات فنی" },
    {
      key: "reviews",
      label: reviewCount > 0 ? `نظرات (${reviewCount.toLocaleString("fa-IR")})` : "نظرات",
    },
  ];

  return (
    <section>
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto border-b border-ink-800"
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-4 py-3 text-sm transition-colors",
              tab === t.key
                ? "border-accent-400 font-bold text-fg"
                : "border-transparent text-muted hover:text-fg"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="pt-6">
        {tab === "description" && (
          <p className="max-w-3xl text-sm leading-8 whitespace-pre-line text-muted">
            {description}
          </p>
        )}

        {tab === "specs" &&
          (specs.length > 0 ? (
            <dl className="max-w-3xl divide-y divide-ink-800 overflow-hidden rounded-card border border-ink-800">
              {specs.map((s) => (
                <div
                  key={s.key}
                  className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-center sm:gap-6"
                >
                  <dt className="w-44 shrink-0 text-xs text-muted">{s.key}</dt>
                  <dd className="text-sm text-fg">{s.value}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted">مشخصاتی ثبت نشده است.</p>
          ))}

        {tab === "reviews" && reviewsSlot}
      </div>
    </section>
  );
}
