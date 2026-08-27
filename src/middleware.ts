import { NextResponse, type NextRequest } from "next/server";

/**
 * نگهبان اول مسیرهای خصوصی.
 *
 * قبل از اینکه صفحه‌ای رندر شود بررسی می‌کند که اصلاً کوکی ورود وجود دارد یا
 * نه. اگر نداشته باشد، همان‌جا با کد ۳۰۷ به صفحه‌ی ورود هدایت می‌کند.
 *
 * ⚠️ این جایگزین بررسی‌های سمت سرور نیست، مکمل آن است:
 *   • اینجا فقط «وجود کوکی» چک می‌شود، نه معتبر بودنش و نه نقش کاربر
 *   • بررسی واقعی هویت و نقش، داخل خود صفحه‌ها و Server Action ها انجام
 *     می‌شود (src/lib/session.ts)
 *
 * فایده‌اش این است که بازدیدکننده‌ی واردنشده بدون معطلی و با کد وضعیت درست
 * به صفحه‌ی ورود می‌رود، به‌جای اینکه صفحه نیمه‌رندر شود.
 */

/**
 * ⚠️ عمداً /checkout در این فهرست نیست.
 * طبق طراحی، مرحله‌ی اول تسویه‌حساب «ورود با کد پیامکی» است که همان‌جا
 * داخل صفحه انجام می‌شود. اگر اینجا مسدودش کنیم، کاربر واردنشده به صفحه‌ی
 * ورود پرت می‌شود و آن مرحله بی‌استفاده می‌ماند.
 * ثبت سفارش خودش در startCheckout بررسی ورود را انجام می‌دهد.
 */
const PROTECTED = ["/account", "/admin", "/order"];

/** نام کوکی سشن؛ روی HTTPS پیشوند __Secure- می‌گیرد */
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsAuth = PROTECTED.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`)
  );
  if (!needsAuth) return NextResponse.next();

  const hasSession = SESSION_COOKIES.some((name) =>
    request.cookies.has(name)
  );
  if (hasSession) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl, 307);
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*", "/order/:path*"],
};
