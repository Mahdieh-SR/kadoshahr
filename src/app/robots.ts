import type { MetadataRoute } from "next";
import { baseUrl as base } from "@/lib/base-url";

// بدون این، Next فایل را موقع بیلد تولید می‌کند و آدرس داخلش قفل می‌شود.
export const dynamic = "force-dynamic";

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
