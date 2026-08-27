import { Suspense } from "react";
import { ProductCard } from "./ProductCard";
import { ProductFilters } from "./ProductFilters";
import { SortSelect } from "./SortSelect";
import {
  getFilterFacets,
  getProductCards,
  type ProductSort,
} from "@/lib/products";
import { formatNumber } from "@/lib/format";

export type ListingSearchParams = {
  q?: string;
  sort?: string;
  region?: string | string[];
  platform?: string | string[];
  min?: string;
  max?: string;
};

const validSorts: ProductSort[] = [
  "newest",
  "bestselling",
  "price-asc",
  "price-desc",
];

function asArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function asNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export async function ProductListing({
  title,
  description,
  categorySlug,
  searchParams,
}: {
  title: string;
  description?: string;
  categorySlug?: string;
  searchParams: ListingSearchParams;
}) {
  const sort = validSorts.includes(searchParams.sort as ProductSort)
    ? (searchParams.sort as ProductSort)
    : "newest";

  const [products, facets] = await Promise.all([
    getProductCards({
      categorySlug,
      q: searchParams.q?.trim() || undefined,
      regions: asArray(searchParams.region),
      platforms: asArray(searchParams.platform),
      minPrice: asNumber(searchParams.min),
      maxPrice: asNumber(searchParams.max),
      sort,
    }),
    getFilterFacets(categorySlug),
  ]);

  return (
    <div className="container-page py-12">
      <header className="max-w-2xl">
        <h1 className="text-2xl font-black sm:text-3xl">{title}</h1>
        {description && (
          <p className="mt-3 text-sm leading-7 text-muted">{description}</p>
        )}
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[260px_1fr] lg:gap-12">
        <Suspense fallback={<div className="h-96" />}>
          <ProductFilters facets={facets} />
        </Suspense>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-muted">
              {products.length > 0
                ? `${formatNumber(products.length)} محصول پیدا شد`
                : "نتیجه‌ای پیدا نشد"}
            </p>
            <Suspense fallback={<div className="h-11 w-32" />}>
              <SortSelect />
            </Suspense>
          </div>

          {products.length > 0 ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-card border border-dashed border-ink-700 p-12 text-center">
              <p className="text-sm text-muted">
                با این فیلترها محصولی پیدا نشد.
              </p>
              <p className="mt-2 text-xs text-muted">
                فیلترها را کمتر کنید یا عبارت جستجو را تغییر دهید.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
