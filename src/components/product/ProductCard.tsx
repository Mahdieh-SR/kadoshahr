import Link from "next/link";
import type { ProductCard as ProductCardData } from "@/lib/products";
import { Stars } from "./Stars";
import { discountPercent, formatNumber, formatToman } from "@/lib/format";

export function ProductCard({ product }: { product: ProductCardData }) {
  const off = discountPercent(product.fromPrice, product.fromCompareAtPrice);

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-ink-800 bg-ink-900 transition-colors hover:border-ink-600"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-ink-800">
        {product.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image}
            alt={product.title}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            بدون تصویر
          </div>
        )}

        {off !== null && (
          <span className="absolute top-3 right-3 rounded-lg bg-accent-400 px-2 py-1 text-xs font-bold text-ink-950">
            ٪{off} تخفیف
          </span>
        )}

        {!product.inStock && (
          <span className="absolute inset-0 flex items-center justify-center bg-ink-950/75 text-sm font-medium text-muted">
            ناموجود
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted">{product.categoryName}</span>
          {product.rating !== null && (
            <span className="flex items-center gap-1 text-[11px] text-muted">
              <Stars rating={product.rating} size={12} />
              {formatNumber(product.rating)}
            </span>
          )}
        </div>

        <h3 className="line-clamp-2 flex-1 text-sm leading-6 font-bold text-fg group-hover:text-accent-400">
          {product.title}
        </h3>

        {/* قیمت مستقیم روی کارت — کاربر برای دیدن قیمت مجبور به کلیک نیست */}
        <div className="flex items-end justify-between gap-2 border-t border-ink-800 pt-3">
          <div>
            <span className="block text-[11px] text-muted">شروع قیمت از</span>
            <span className="text-sm font-bold text-fg">
              {formatToman(product.fromPrice)}
            </span>
          </div>
          {product.fromCompareAtPrice && off !== null && (
            <span className="pb-0.5 text-xs text-muted line-through">
              {formatToman(product.fromCompareAtPrice)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
