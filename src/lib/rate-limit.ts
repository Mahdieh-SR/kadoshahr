import { headers } from "next/headers";
import { prisma } from "./prisma";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * محدودیت نرخ درخواست با الگوی «پنجره‌ی ثابت» و پشتوانه‌ی دیتابیس.
 *
 * کل منطق در یک دستور اتمیک `INSERT ... ON CONFLICT` انجام می‌شود تا دو درخواست
 * هم‌زمان نتوانند شمارنده را دور بزنند (شرط رقابتی read-then-write).
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const rows = await prisma.$queryRaw<
    { count: number; windowStart: Date }[]
  >`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds}::double precision)
        THEN 1
        ELSE "RateLimit"."count" + 1
      END,
      "windowStart" = CASE
        WHEN "RateLimit"."windowStart" < now() - make_interval(secs => ${windowSeconds}::double precision)
        THEN now()
        ELSE "RateLimit"."windowStart"
      END
    RETURNING "count", "windowStart"
  `;

  const row = rows[0];
  if (!row) return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };

  const count = Number(row.count);
  const elapsed = (Date.now() - new Date(row.windowStart).getTime()) / 1000;
  const retryAfterSeconds = Math.max(1, Math.ceil(windowSeconds - elapsed));

  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    retryAfterSeconds: count <= limit ? 0 : retryAfterSeconds,
  };
}

/**
 * IP کاربر را از هدرهای پروکسی استخراج می‌کند.
 * در حالت توسعه معمولاً مقداری وجود ندارد و به "local" برمی‌گردد.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "local";
}

/** پیام فارسی یکدست برای وقتی که سقف درخواست پر شده است. */
export function tooManyRequestsMessage(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `تعداد درخواست‌ها بیش از حد مجاز است. ${minutes} دقیقه دیگر دوباره تلاش کنید.`;
  }
  return `تعداد درخواست‌ها بیش از حد مجاز است. ${seconds} ثانیه دیگر دوباره تلاش کنید.`;
}
