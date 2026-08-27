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

  // خروجی مستقل — سرورهای ابری (لیارا و مشابه) این حالت را لازم دارند.
  // خودمان تنظیمش می‌کنیم تا سرور مجبور نشود فایل تنظیمات جداگانه بسازد.
  output: "standalone",

  // نسخه‌ی Next در هدر پاسخ فاش نشود
  poweredByHeader: false,

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
