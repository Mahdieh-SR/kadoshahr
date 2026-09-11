import { prisma } from "./prisma";
import { averageRating } from "./reviews";
import type { OptionLabels } from "@/components/product/VariantPicker";

export type ProductCard = {
  id: string;
  slug: string;
  title: string;
  image: string | null;
  categoryName: string;
  categorySlug: string;
  /** ارزان‌ترین وردایانت فعال و موجود */
  fromPrice: number;
  fromCompareAtPrice: number | null;
  variantCount: number;
  inStock: boolean;
  soldCount: number;
  /** میانگین امتیاز؛ اگر نظری نباشد null */
  rating: number | null;
  reviewCount: number;
};

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  images: true,
  soldCount: true,
  reviewCount: true,
  ratingSum: true,
  category: { select: { name: true, slug: true } },
  variants: {
    where: { isActive: true },
    select: {
      price: true,
      compareAtPrice: true,
      stock: true,
      platform: true,
      region: true,
    },
  },
} as const;

type RawVariant = {
  price: number;
  compareAtPrice: number | null;
  stock: number;
  platform: string;
  region: string;
};

type RawCard = {
  id: string;
  slug: string;
  title: string;
  images: string[];
  soldCount: number;
  reviewCount: number;
  ratingSum: number;
  category: { name: string; slug: string };
  variants: RawVariant[];
};

/** شرط‌هایی که کاربر روی وردایانت‌ها اعمال کرده — برای انتخاب قیمت نمایشی کارت */
type VariantMatch = {
  regions?: string[];
  platforms?: string[];
  minPrice?: number;
  maxPrice?: number;
};

function matchesFilter(v: RawVariant, f: VariantMatch): boolean {
  if (f.regions?.length && !f.regions.includes(v.region)) return false;
  if (f.platforms?.length && !f.platforms.includes(v.platform)) return false;
  if (f.minPrice !== undefined && v.price < f.minPrice) return false;
  if (f.maxPrice !== undefined && v.price > f.maxPrice) return false;
  return true;
}

function toCard(p: RawCard, filter: VariantMatch = {}): ProductCard {
  // قیمت روی کارت باید همان وردایانتی را نشان بدهد که با فیلتر کاربر می‌خواند.
  // وگرنه کاربر بازه‌ی «۱ تا ۲ میلیون» می‌زند ولی روی کارت ۷۸۰ هزار می‌بیند و
  // فکر می‌کند فیلتر کار نکرده است.
  const matching = p.variants.filter((v) => matchesFilter(v, filter));
  const relevant = matching.length > 0 ? matching : p.variants;

  const inStockVariants = relevant.filter((v) => v.stock > 0);
  const pool = inStockVariants.length > 0 ? inStockVariants : relevant;
  const cheapest = pool.reduce<RawVariant | null>(
    (min, v) => (min === null || v.price < min.price ? v : min),
    null
  );

  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    image: p.images[0] ?? null,
    categoryName: p.category.name,
    categorySlug: p.category.slug,
    fromPrice: cheapest?.price ?? 0,
    fromCompareAtPrice: cheapest?.compareAtPrice ?? null,
    variantCount: relevant.length,
    inStock: inStockVariants.length > 0,
    soldCount: p.soldCount,
    rating: averageRating(p.ratingSum, p.reviewCount),
    reviewCount: p.reviewCount,
  };
}

export type ProductSort = "newest" | "bestselling" | "price-asc" | "price-desc";

export type ProductFilters = {
  categorySlug?: string;
  q?: string;
  regions?: string[];
  platforms?: string[];
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
  take?: number;
  /**
   * فقط محصولاتی که همین حالا قابل خریدند.
   *
   * برای ویترین صفحه‌ی اصلی لازم است: نشان دادن محصول ناموجود در جای
   * پرترافیک سایت، بازدیدکننده را به صفحه‌ای می‌برد که نمی‌تواند چیزی از آن
   * بخرد. در صفحه‌ی فهرست محصولات عمداً روشن نمی‌شود تا کاربر بداند چه
   * چیزهایی موجود می‌شوند.
   */
  inStockOnly?: boolean;
};

export async function getProductCards(
  filters: ProductFilters = {}
): Promise<ProductCard[]> {
  const {
    categorySlug,
    q,
    regions,
    platforms,
    minPrice,
    maxPrice,
    sort = "newest",
    take,
    inStockOnly = false,
  } = filters;

  // شرط‌های مربوط به وردایانت با هم داخل یک `some` قرار می‌گیرند تا
  // «یک وردایانت که هم‌زمان همه‌ی شرط‌ها را داشته باشد» پیدا شود،
  // نه وردایانت‌های مختلف که هرکدام یکی از شرط‌ها را دارند.
  const variantWhere: Record<string, unknown> = { isActive: true };
  if (inStockOnly) variantWhere.stock = { gt: 0 };
  if (regions?.length) variantWhere.region = { in: regions };
  if (platforms?.length) variantWhere.platform = { in: platforms };
  if (minPrice !== undefined || maxPrice !== undefined) {
    variantWhere.price = {
      ...(minPrice !== undefined ? { gte: minPrice } : {}),
      ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
    };
  }

  const hasVariantFilter = Object.keys(variantWhere).length > 1;

  const products = (await prisma.product.findMany({
    where: {
      isActive: true,
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { description: { contains: q, mode: "insensitive" as const } },
              {
                variants: {
                  some: {
                    isActive: true,
                    OR: [
                      { platform: { contains: q, mode: "insensitive" as const } },
                      { region: { contains: q, mode: "insensitive" as const } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
      ...(hasVariantFilter ? { variants: { some: variantWhere } } : {}),
    },
    select: cardSelect,
    orderBy:
      sort === "bestselling"
        ? [{ soldCount: "desc" as const }, { createdAt: "desc" as const }]
        : [{ createdAt: "desc" as const }],
    ...(take ? { take } : {}),
  })) as RawCard[];

  const cards = products.map((p) =>
    toCard(p, { regions, platforms, minPrice, maxPrice })
  );

  // مرتب‌سازی بر اساس قیمت روی «ارزان‌ترین وردایانت» انجام می‌شود،
  // که در دیتابیس یک ستون مستقل نیست؛ پس اینجا مرتب می‌کنیم.
  if (sort === "price-asc") cards.sort((a, b) => a.fromPrice - b.fromPrice);
  if (sort === "price-desc") cards.sort((a, b) => b.fromPrice - a.fromPrice);

  return cards;
}

export async function getCategories() {
  return prisma.category.findMany({
    // دسته‌ی بدون محصول نمایش داده نمی‌شود
    where: { products: { some: { isActive: true } } },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      icon: true,
      _count: { select: { products: { where: { isActive: true } } } },
    },
  });
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    select: { id: true, name: true, slug: true },
  });
}

export type ProductSpec = { key: string; value: string };

export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      specs: true,
      optionLabels: true,
      images: true,
      reviewCount: true,
      ratingSum: true,
      categoryId: true,
      category: { select: { name: true, slug: true } },
      variants: {
        where: { isActive: true },
        orderBy: { price: "asc" },
        select: {
          id: true,
          label: true,
          platform: true,
          region: true,
          capacity: true,
          price: true,
          compareAtPrice: true,
          stock: true,
        },
      },
    },
  });

  if (!product) return null;

  const specs: ProductSpec[] = Array.isArray(product.specs)
    ? (product.specs as unknown as ProductSpec[]).filter(
        (s) => s && typeof s.key === "string" && typeof s.value === "string"
      )
    : [];

  return { ...product, specs, optionLabels: readOptionLabels(product.optionLabels) };
}

const OPTION_AXES = ["platform", "region", "capacity"] as const;

/**
 * فقط سه محور مجاز و فقط عنوان متنی — هرچه غیر از این باشد نادیده می‌رود.
 * محتوای JSON از دیتابیس می‌آید و ممکن است دستی ویرایش شده باشد، پس
 * اینجا مثل ورودی ناشناس با آن رفتار می‌کنیم.
 */
function readOptionLabels(value: unknown): OptionLabels | null {
  if (!Array.isArray(value)) return null;

  const out: OptionLabels = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const { axis, label } = item as { axis?: unknown; label?: unknown };

    if (typeof axis !== "string" || typeof label !== "string") continue;
    if (!OPTION_AXES.includes(axis as (typeof OPTION_AXES)[number])) continue;
    if (!label.trim() || seen.has(axis)) continue;

    seen.add(axis);
    out.push({ axis: axis as (typeof OPTION_AXES)[number], label: label.trim() });
  }

  return out.length > 0 ? out : null;
}

export async function getRelatedProducts(
  productId: string,
  categoryId: string
): Promise<ProductCard[]> {
  const products = (await prisma.product.findMany({
    where: { isActive: true, categoryId, NOT: { id: productId } },
    select: cardSelect,
    orderBy: { soldCount: "desc" },
    take: 4,
  })) as RawCard[];
  return products.map((p) => toCard(p));
}

/** مقادیر یکتای ریجن و پلتفرم برای ساختن فیلترها */
export async function getFilterFacets(categorySlug?: string) {
  const variants = await prisma.productVariant.findMany({
    where: {
      isActive: true,
      product: {
        isActive: true,
        ...(categorySlug ? { category: { slug: categorySlug } } : {}),
      },
    },
    select: { region: true, platform: true, price: true },
  });

  const regions = [...new Set(variants.map((v) => v.region))].sort();
  const platforms = [...new Set(variants.map((v) => v.platform))].sort();
  const prices = variants.map((v) => v.price);

  return {
    regions,
    platforms,
    minPrice: prices.length ? Math.min(...prices) : 0,
    maxPrice: prices.length ? Math.max(...prices) : 0,
  };
}
