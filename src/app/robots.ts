import type { MetadataRoute } from "next";

const base = () => process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

/**
 * به موتورهای جستجو می‌گوید کدام بخش‌ها را ایندکس نکنند.
 * صفحه‌های خصوصی (حساب کاربری، سبد، پرداخت، پنل مدیریت) نباید در گوگل بیایند.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/account",
        "/cart",
        "/checkout",
        "/order",
        "/login",
        "/api",
        "/mock-gateway",
        "/payment-error",
      ],
    },
    sitemap: `${base()}/sitemap.xml`,
  };
}
