import { NextResponse, type NextRequest } from "next/server";

/**
 * دو کار انجام می‌دهد، روی هر درخواست:
 *
 *  ۱. هدرهای امنیتی را روی همه‌ی پاسخ‌ها می‌گذارد
 *  ۲. مسیرهای خصوصی را قبل از رندر شدن قفل می‌کند
 *
 * ⚠️ چرا هدرها اینجا و نه در next.config؟
 * سرور لیارا هنگام بیلد، فایل next.config خودش را جایگزین فایل ما می‌کند
 * (برای تنظیم standalone) و در نتیجه بخش headers ما از بین می‌رفت.
 * اینجا دست‌نخورده باقی می‌ماند و روی هر سروری کار می‌کند.
 */

/** هدرهای امنیتی — هرکدام جلوی یک نوع حمله‌ی رایج را می‌گیرد */
const SECURITY_HEADERS: Record<string, string> = {
  // جلوگیری از قرار گرفتن سایت داخل iframe سایت دیگر (clickjacking)
  "X-Frame-Options": "DENY",
  // مرورگر نوع فایل را حدس نزند
  "X-Content-Type-Options": "nosniff",
  // آدرس صفحه‌ی ما به سایت‌های بیرونی لو نرود
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // دسترسی به دوربین، میکروفن و موقعیت مکانی لازم نیست
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  // اجبار مرورگر به استفاده از HTTPS
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};

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

function withSecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  // نسخه‌ی فریم‌ورک را فاش نکن
  response.headers.delete("x-powered-by");
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsAuth = PROTECTED.some(
    (base) => pathname === base || pathname.startsWith(`${base}/`)
  );

  if (needsAuth) {
    const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));

    if (!hasSession) {
      // ⚠️ اینجا فقط «وجود کوکی» بررسی می‌شود، نه معتبر بودنش و نه نقش کاربر.
      // بررسی واقعی هویت و نقش داخل خود صفحه‌ها و Server Action ها انجام
      // می‌شود (src/lib/session.ts). این فقط یک سد اول برای سرعت است.
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return withSecurityHeaders(NextResponse.redirect(loginUrl, 307));
    }
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  // همه‌ی مسیرها به‌جز فایل‌های ثابت، تا هدرهای امنیتی همه‌جا اعمال شوند
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|products/.*\\.svg).*)",
  ],
};
