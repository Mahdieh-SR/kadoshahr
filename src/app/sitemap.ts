import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

const base = () => process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

/**
 * نقشه‌ی سایت برای موتورهای جستجو — فقط صفحه‌های عمومی.
 * محصولات و دسته‌بندی‌ها مستقیم از دیتابیس خوانده می‌شوند تا همیشه به‌روز باشد.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const root = base();

  const staticPages: MetadataRoute.Sitemap = [
    { url: root, changeFrequency: "daily", priority: 1 },
    { url: `${root}/products`, changeFrequency: "daily", priority: 0.9 },
  ];

  try {
    const [categories, products] = await Promise.all([
      prisma.category.findMany({ select: { slug: true } }),
      prisma.product.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
      }),
    ]);

    return [
      ...staticPages,
      ...categories.map((c) => ({
        url: `${root}/category/${c.slug}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      })),
      ...products.map((p) => ({
        url: `${root}/product/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch {
    // اگر دیتابیس در دسترس نبود، دست‌کم صفحه‌های ثابت برگردانده شوند
    return staticPages;
  }
}
