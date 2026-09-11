import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { baseUrl as base } from "@/lib/base-url";

// بدون این، Next نقشه را موقع بیلد می‌سازد — با آدرس اشتباه و بدون
// محصولاتی که بعداً اضافه می‌شوند.
export const dynamic = "force-dynamic";

/**
 * نقشه‌ی سایت برای موتورهای جستجو — فقط صفحه‌های عمومی.
 * محصولات و دسته‌بندی‌ها مستقیم از دیتابیس خوانده می‌شوند تا همیشه به‌روز باشد.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const root = base();

  const staticPages: MetadataRoute.Sitemap = [
    { url: root, changeFrequency: "daily", priority: 1 },
    { url: `${root}/products`, changeFrequency: "daily", priority: 0.9 },
    // صفحه‌های ثابت — محتوایشان به‌ندرت عوض می‌شود ولی برای اعتماد کاربر و
    // ارزیابی گوگل مهم‌اند، پس باید در نقشه‌ی سایت باشند.
    { url: `${root}/about`, changeFrequency: "monthly" as const, priority: 0.5 },
    { url: `${root}/contact`, changeFrequency: "monthly" as const, priority: 0.5 },
  ];

  try {
    const [categories, products] = await Promise.all([
      prisma.category.findMany({
        where: { products: { some: { isActive: true } } },
        select: { slug: true },
      }),
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
