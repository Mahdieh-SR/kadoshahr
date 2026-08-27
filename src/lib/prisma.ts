import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL تعریف نشده است. رشته اتصال Neon را در فایل .env قرار دهید."
  );
}

/**
 * خطاهایی که یعنی «درخواست اصلاً به دیتابیس نرسید».
 * فقط این‌ها دوباره تلاش می‌شوند؛ خطای خودِ کوئری هرگز تکرار نمی‌شود تا
 * یک عملیات نوشتن دو بار انجام نشود.
 */
const TRANSIENT_CONNECTION_ERRORS = [
  "ENOTFOUND", // DNS موقتاً جواب نداد
  "EAI_AGAIN", // خطای موقت DNS
  "ETIMEDOUT", // مهلت اتصال تمام شد
  "ECONNRESET",
  "ECONNREFUSED",
  "Connection terminated",
  "Timed out fetching a new connection",
  // دیتابیس رایگان Neon بعد از بی‌کاری می‌خوابد؛ اولین درخواست بعدی تا
  // بیدار شدنش این خطاها را می‌گیرد.
  "P1001",
  "DatabaseNotReachable",
  "Can't reach database server",
];

/** ۰.۵ ثانیه، ۱.۵، ۴، ۸ — مجموعاً ۱۴ ثانیه فرصت برای بیدار شدن دیتابیس */
const RETRY_DELAYS_MS = [500, 1_500, 4_000, 8_000];

function isTransient(error: unknown): boolean {
  const text = [
    (error as { code?: string })?.code,
    (error as { message?: string })?.message,
    (error as { cause?: { code?: string } })?.cause?.code,
  ]
    .filter(Boolean)
    .join(" ");

  return TRANSIENT_CONNECTION_ERRORS.some((needle) => text.includes(needle));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function createPrismaClient() {
  const client = new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      // دیتابیس رایگان Neon بعد از چند دقیقه بی‌کاری می‌خوابد و اولین
      // درخواست بعدی باید منتظر بیدار شدنش بماند. مهلت پیش‌فرض pg برای
      // این کار کوتاه است و خطای ETIMEDOUT می‌دهد.
      connectionTimeoutMillis: 30_000,
      idleTimeoutMillis: 30_000,
      keepAlive: true,
      max: 10,
    }),
  });

  return client.$extends({
    query: {
      async $allOperations({ query, args }) {
        let lastError: unknown;

        for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
          try {
            return await query(args);
          } catch (error) {
            lastError = error;
            if (!isTransient(error)) throw error;

            const delay = RETRY_DELAYS_MS[attempt];
            if (delay === undefined) break;

            if (attempt === 0) {
              console.info("دیتابیس در دسترس نبود؛ در حال تلاش مجدد…");
            }
            await sleep(delay);
          }
        }

        throw lastError;
      },
    },
  });
}

// در حالت توسعه، Next.js ماژول‌ها را مکرر بارگذاری می‌کند؛
// نگه داشتن نمونه روی globalThis از ساخته شدن ده‌ها connection pool جلوگیری می‌کند.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
