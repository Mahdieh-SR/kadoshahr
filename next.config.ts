import type { NextConfig } from "next";

/**
 * هدرهای امنیتی که روی همه‌ی صفحات اعمال می‌شوند.
 * هرکدام جلوی یک نوع حمله‌ی رایج را می‌گیرند.
 */
const securityHeaders = [
  {
    // جلوگیری از قرار گرفتن سایت داخل iframe سایت دیگر (clickjacking)
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // مرورگر نوع فایل را حدس نزند — جلوی اجرای فایل آپلودی به‌عنوان اسکریپت
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // آدرس صفحه‌ی ما به سایت‌های بیرونی لو نرود
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // دسترسی به دوربین، میکروفن و موقعیت مکانی لازم نیست
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    // اجبار مرورگر به استفاده از HTTPS (فقط روی دامنه‌ی واقعی اثر دارد)
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // تصاویر محصولات با تگ <img> ساده نمایش داده می‌شوند تا ادمین بتواند
  // آدرس تصویر از هر دامنه‌ای وارد کند، بدون نیاز به تغییر این فایل.

  // ⚠️ `output: "standalone"` عمداً اینجا نیست.
  //
  // آن تنظیم برای میزبانی کانتینری (رانفلر) و اجرای محلی پشت کلادفلر تانل
  // لازم بود. ورسل خودش خروجی بیلد را می‌سازد و استاندالون در آن نه لازم
  // است نه مفید. اگر روزی به میزبانی خودگردان برگشتی، این سه چیز با هم
  // برمی‌گردند: همین خط، اسکریپت `prepare-standalone.mjs`، و `start` در
  // package.json که باید به `node .next/standalone/server.js` تغییر کند.

  // نسخه‌ی Next در هدر پاسخ فاش نشود
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
