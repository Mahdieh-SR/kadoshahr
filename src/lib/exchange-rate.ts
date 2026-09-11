import { prisma } from "./prisma";

/**
 * قیمت‌گذاری دلاری.
 *
 * ایده‌ی اصلی: قیمت دلاری روی خود نسخه ذخیره می‌شود، ولی چیزی که کل سایت
 * می‌خواند همان ستون تومانی `price` است. هر بار نرخ عوض شود، این فایل ستون
 * تومانی همه‌ی نسخه‌های دلاری را دوباره حساب و بازنویسی می‌کند.
 *
 * ⚠️ نتیجه‌ی امنیتی مهم: هیچ جای دیگری از سایت لازم نیست بداند نرخ دلار چند
 * است. قیمت همچنان یک عدد ثابت در دیتابیس است و مثل قبل فقط سمت سرور خوانده
 * می‌شود. مرورگر مشتری هرگز در محاسبه‌ی قیمت نقشی ندارد.
 */

/** قیمت دلاری به «سِنت» ذخیره می‌شود تا عدد اعشاری نداشته باشیم */
export const CENTS_PER_USD = 100;

/** حداقل قیمت مجاز هر نسخه (هم‌راستا با adminProductSchema) */
export const MIN_PRICE_TOMAN = 1000;

/** اگر نرخ جدید بیشتر از این درصد با نرخ فعلی فرق داشته باشد، تایید دوباره لازم است */
export const RATE_JUMP_GUARD_PERCENT = 5;

export type PricingSettings = {
  usdRate: number;
  marginPercent: number;
  roundTo: number;
  suggestedRate: number | null;
  suggestedAt: Date | null;
  suggestedFrom: string | null;
  appliedAt: Date | null;
  updatedAt: Date;
};

const DEFAULTS: PricingSettings = {
  usdRate: 0,
  marginPercent: 0,
  roundTo: 1000,
  suggestedRate: null,
  suggestedAt: null,
  suggestedFrom: null,
  appliedAt: null,
  updatedAt: new Date(0),
};

/** تنظیمات فعلی. اگر سطر تنظیمات نبود، ساخته می‌شود. */
export async function getPricingSettings(): Promise<PricingSettings> {
  const row = await prisma.pricingSettings.findUnique({ where: { id: 1 } });
  if (row) return row;

  return prisma.pricingSettings.create({ data: { id: 1, ...DEFAULTS, updatedAt: undefined } });
}

/**
 * تبدیل قیمت دلاری به تومان.
 *
 * فرمول:  سِنت ÷ ۱۰۰ × نرخ × (۱ + سود٪) ، بعد رند **به بالا** تا مضربی از roundTo
 *
 * چرا به بالا؟ چون رند کردن به پایین یعنی هر بار چند صد تومان ضرر، و روی
 * حجم بالا جمع می‌شود. رند به بالا حداکثر به اندازه‌ی roundTo به نفع فروشنده است.
 */
export function tomanFromUsd(
  priceUsdCents: number,
  rate: number,
  marginPercent: number,
  roundTo: number
): number {
  if (!Number.isFinite(priceUsdCents) || priceUsdCents <= 0) return MIN_PRICE_TOMAN;
  if (!Number.isFinite(rate) || rate <= 0) return MIN_PRICE_TOMAN;

  const step = Number.isFinite(roundTo) && roundTo > 0 ? Math.floor(roundTo) : 1;
  const raw = (priceUsdCents * rate * (100 + marginPercent)) / (CENTS_PER_USD * 100);
  const rounded = Math.ceil(raw / step) * step;

  return Math.max(MIN_PRICE_TOMAN, rounded);
}

/** همان محاسبه برای «قیمت قبل از تخفیف» — صفر یا خالی یعنی تخفیفی نمایش داده نشود */
export function compareTomanFromUsd(
  compareUsdCents: number | null | undefined,
  rate: number,
  marginPercent: number,
  roundTo: number
): number | null {
  if (!compareUsdCents || compareUsdCents <= 0) return null;
  return tomanFromUsd(compareUsdCents, rate, marginPercent, roundTo);
}

/**
 * قیمت تومانی همه‌ی نسخه‌های دلاری را با نرخ داده‌شده بازنویسی می‌کند.
 *
 * عمداً یک دستور SQL است، نه حلقه: با صدها نسخه، رفت‌وبرگشت تک‌تک روی
 * Neon فرانکفورت دقیقه‌ها طول می‌کشد (دام شماره ۳ در HANDOFF.md).
 */
export async function repriceUsdVariants(
  rate: number,
  marginPercent: number,
  roundTo: number
): Promise<number> {
  const step = roundTo > 0 ? Math.floor(roundTo) : 1;

  return prisma.$executeRaw`
    UPDATE "ProductVariant"
       SET "price" = GREATEST(
             ${MIN_PRICE_TOMAN}::int,
             (CEIL(("priceUsd"::numeric * ${rate}::numeric * (100 + ${marginPercent}::numeric)
                    / ${CENTS_PER_USD * 100}::numeric) / ${step}::numeric) * ${step}::numeric)::int
           ),
           "compareAtPrice" = CASE
             WHEN "compareAtUsd" IS NULL OR "compareAtUsd" <= 0 THEN NULL
             ELSE GREATEST(
               ${MIN_PRICE_TOMAN}::int,
               (CEIL(("compareAtUsd"::numeric * ${rate}::numeric * (100 + ${marginPercent}::numeric)
                      / ${CENTS_PER_USD * 100}::numeric) / ${step}::numeric) * ${step}::numeric)::int
             )
           END
     WHERE "usdPriced" = true
       AND "priceUsd" IS NOT NULL
       AND "priceUsd" > 0
  `;
}

/** چند نسخه قیمت دلاری دارند */
export async function countUsdVariants(): Promise<number> {
  return prisma.productVariant.count({ where: { usdPriced: true, priceUsd: { gt: 0 } } });
}

/**
 * چند نمونه برای پیش‌نمایش «قیمت الان / قیمت بعد از اعمال نرخ».
 * تا مدیر قبل از زدن دکمه ببیند دقیقاً چه اتفاقی می‌افتد.
 */
export async function previewReprice(
  rate: number,
  marginPercent: number,
  roundTo: number,
  take = 8
) {
  const variants = await prisma.productVariant.findMany({
    where: { usdPriced: true, priceUsd: { gt: 0 } },
    select: {
      id: true,
      label: true,
      price: true,
      priceUsd: true,
      product: { select: { title: true } },
    },
    orderBy: { price: "desc" },
    take,
  });

  return variants.map((v) => ({
    id: v.id,
    title: v.product.title,
    label: v.label,
    usd: (v.priceUsd ?? 0) / CENTS_PER_USD,
    before: v.price,
    after: tomanFromUsd(v.priceUsd ?? 0, rate, marginPercent, roundTo),
  }));
}

/* ─────────────────────────── گرفتن نرخ روز ─────────────────────────── */

/**
 * سرویس پیش‌فرض: جدول «دلار بازار آزاد» tgju.
 * مقدارها به **ریال** و مربوط به بسته‌شدن روز کاری قبل هستند — یعنی این یک
 * نرخ لحظه‌ای نیست، فقط یک نقطه‌ی شروع برای تصمیم مدیر.
 *
 * برای عوض کردن سرویس، بدون تغییر کد:
 *   USD_RATE_URL   آدرس سرویس
 *   USD_RATE_UNIT  "rial" (پیش‌فرض) یا "toman"
 */
const DEFAULT_RATE_URL =
  "https://api.tgju.org/v1/market/indicator/summary-table-data/price_dollar_rl";

export type RateSuggestion =
  | { ok: true; rate: number; source: string; note: string }
  | { ok: false; error: string };

/**
 * نرخ پیشنهادی را از سرویس بیرونی می‌گیرد.
 *
 * ⚠️ این تابع هرگز خودش قیمتی را عوض نمی‌کند. فقط یک عدد برمی‌گرداند تا در
 * پنل به مدیر نشان داده شود. تصمیم نهایی همیشه با مدیر است.
 */
export async function fetchSuggestedRate(): Promise<RateSuggestion> {
  const url = process.env.USD_RATE_URL || DEFAULT_RATE_URL;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      return { ok: false, error: `سرویس نرخ پاسخ ${response.status} داد.` };
    }

    const payload: unknown = await response.json();
    const raw = extractRate(payload);

    if (raw === null) {
      return { ok: false, error: "پاسخ سرویس نرخ قابل خواندن نبود." };
    }

    // tgju مقدارها را به ریال می‌دهد و سایت ما تومان کار می‌کند
    const unit = (process.env.USD_RATE_UNIT ?? "rial").toLowerCase();
    const toman = unit === "toman" ? Math.round(raw) : Math.round(raw / 10);

    if (toman < 1000 || toman > 100_000_000) {
      return { ok: false, error: `نرخ دریافتی (${toman} تومان) منطقی به نظر نمی‌رسد.` };
    }

    return {
      ok: true,
      rate: toman,
      source: new URL(url).hostname,
      note: "نرخ بسته‌شدن دلار بازار آزاد در آخرین روز کاری",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `اتصال به سرویس نرخ ممکن نشد (${message}).` };
  }
}

/** «۲,۰۰۶,۰۰۰» یا «2006000» → 2006000 */
function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[,٬،\s]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * نرخ را از پاسخ سرویس بیرون می‌کشد.
 *
 * چند شکل رایج پشتیبانی می‌شود تا اگر بعداً سرویس عوض شد، فقط آدرسش در .env
 * تغییر کند و لازم نباشد کد دست بخورد:
 *
 *   tgju:      { data: [ [بازگشایی, کمترین, بیشترین, پایانی, …], … ] }
 *   ساده:      { price: 200600 }  ·  { rate: … }  ·  { value: … }
 *   تودرتو:    { usd: { sell: … } }  ·  { usd: 200600 }
 */
function extractRate(payload: unknown): number | null {
  if (payload === null || typeof payload !== "object") return null;
  const object = payload as Record<string, unknown>;

  // شکل tgju — سطر اول تازه‌ترین روز، ستون چهارم قیمت پایانی
  const rows = object.data;
  if (Array.isArray(rows) && rows.length > 0) {
    const first = rows[0];
    if (Array.isArray(first) && first.length >= 4) {
      const closing = toNumber(first[3]);
      if (closing !== null) return closing;
    }
  }

  for (const key of ["price", "rate", "value", "sell", "usd"]) {
    const direct = toNumber(object[key]);
    if (direct !== null) return direct;

    const nested = object[key];
    if (nested && typeof nested === "object") {
      const inner = nested as Record<string, unknown>;
      for (const innerKey of ["sell", "price", "value", "rate"]) {
        const found = toNumber(inner[innerKey]);
        if (found !== null) return found;
      }
    }
  }

  return null;
}

/** آیا نرخ جدید جهش مشکوکی نسبت به نرخ فعلی دارد؟ */
export function isSuspiciousJump(currentRate: number, newRate: number): boolean {
  if (currentRate <= 0) return false;
  const changePercent = (Math.abs(newRate - currentRate) / currentRate) * 100;
  return changePercent > RATE_JUMP_GUARD_PERCENT;
}
