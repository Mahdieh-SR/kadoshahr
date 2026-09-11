/**
 * کپی کردن کل داده‌ها از یک دیتابیس به دیتابیس دیگر — برای مهاجرت از Neon
 * به Postgres رانفلر.
 *
 * چرا به‌جای pg_dump؟
 * `pg_dump` روی ویندوز معمولاً نصب نیست و نسخه‌اش هم باید با سرور بخواند.
 * اینجا از همان درایور Node استفاده می‌کنیم که خود سایت با آن کار می‌کند،
 * پس هرجا سایت وصل می‌شود این هم وصل می‌شود.
 *
 * پیش‌نیاز: جدول‌ها باید از قبل روی مقصد ساخته شده باشند
 *   DATABASE_URL=<مقصد> npm run db:push
 *
 * اجرا:
 *   SOURCE_DATABASE_URL=<مبدا> TARGET_DATABASE_URL=<مقصد> node scripts/db-copy.mjs
 *   … --dry-run   فقط تعداد سطرهای دو طرف را نشان می‌دهد
 */
import "dotenv/config";
import { Client } from "pg";

const DRY_RUN = process.argv.includes("--dry-run");

const SOURCE = process.env.SOURCE_DATABASE_URL;
const TARGET = process.env.TARGET_DATABASE_URL;

if (!SOURCE || !TARGET) {
  console.error(
    "✖ باید هر دو متغیر تنظیم شوند:\n" +
      "   SOURCE_DATABASE_URL  رشته‌ی اتصال دیتابیس فعلی (Neon)\n" +
      "   TARGET_DATABASE_URL  رشته‌ی اتصال دیتابیس جدید (رانفلر)"
  );
  process.exit(1);
}

if (SOURCE === TARGET) {
  console.error("✖ مبدا و مقصد یکی هستند. کپی انجام نشد.");
  process.exit(1);
}

/**
 * ترتیب مهم است: هر جدول بعد از جدولی می‌آید که به آن کلید خارجی دارد.
 * اگر ترتیب به‌هم بخورد، درج با خطای foreign key رد می‌شود.
 */
const TABLES = [
  "User",
  "Category",
  "Product",
  "ProductVariant",
  "DiscountCode",
  "Order",
  "OrderItem",
  "DiscountRedemption",
  "Review",
  "PricingSettings",
  "MockPayment",
  // OtpCode و RateLimit عمداً کپی نمی‌شوند: کدهای یک‌بارمصرف و شمارنده‌های
  // موقتی‌اند و خالی ماندنشان روی مقصد هیچ ضرری ندارد.
];

const source = new Client({ connectionString: SOURCE });
const target = new Client({ connectionString: TARGET });
await source.connect();
await target.connect();

const quote = (id) => `"${id.replace(/"/g, '""')}"`;

async function columnsOf(client, table) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [table]
  );
  return rows.map((r) => r.column_name);
}

async function countOf(client, table) {
  const { rows } = await client.query(`SELECT count(*)::int AS n FROM ${quote(table)}`);
  return rows[0].n;
}

/* ── بررسی اینکه مقصد واقعاً آماده و خالی است ── */

const notEmpty = [];
for (const table of TABLES) {
  let n;
  try {
    n = await countOf(target, table);
  } catch {
    console.error(
      `✖ جدول «${table}» روی مقصد وجود ندارد.\n` +
        "   اول جدول‌ها را بساز:  DATABASE_URL=<مقصد> npm run db:push"
    );
    process.exit(1);
  }
  if (n > 0) notEmpty.push(`${table} (${n} سطر)`);
}

if (notEmpty.length && !DRY_RUN) {
  console.error(
    "✖ مقصد خالی نیست:\n   " +
      notEmpty.join("\n   ") +
      "\n\n   کپی انجام نشد تا داده‌ها دوبار درج نشوند.\n" +
      "   اگر می‌خواهی از نو شروع کنی:  DATABASE_URL=<مقصد> npm run db:reset"
  );
  process.exit(1);
}

/* ── کپی ── */

console.log(`\n${DRY_RUN ? "— حالت بررسی، هیچ چیزی نوشته نمی‌شود —\n" : ""}`);

let total = 0;

for (const table of TABLES) {
  const srcCols = await columnsOf(source, table);
  const dstCols = await columnsOf(target, table);
  const cols = srcCols.filter((c) => dstCols.includes(c));

  const missing = srcCols.filter((c) => !dstCols.includes(c));
  if (missing.length) {
    console.error(
      `✖ ستون‌های «${missing.join("، ")}» در جدول ${table} روی مقصد نیست.\n` +
        "   یعنی schema دو طرف یکی نیست. اول db:push را روی مقصد بزن."
    );
    process.exit(1);
  }

  const { rows } = await source.query(`SELECT * FROM ${quote(table)}`);

  if (DRY_RUN) {
    console.log(`  ${table}: ${rows.length} سطر آماده‌ی کپی`);
    total += rows.length;
    continue;
  }

  if (rows.length === 0) {
    console.log(`  ${table}: خالی`);
    continue;
  }

  // همه‌ی سطرها در یک تراکنش: یا کل جدول می‌رود، یا هیچ‌کدام.
  await target.query("BEGIN");
  try {
    const colList = cols.map(quote).join(", ");
    for (const row of rows) {
      const values = cols.map((c) => row[c]);
      const params = cols.map((_, i) => `$${i + 1}`).join(", ");
      await target.query(
        `INSERT INTO ${quote(table)} (${colList}) VALUES (${params})`,
        values
      );
    }
    await target.query("COMMIT");
  } catch (error) {
    await target.query("ROLLBACK");
    console.error(`✖ کپی جدول ${table} شکست خورد: ${error.message}`);
    process.exit(1);
  }

  console.log(`  ✔ ${table}: ${rows.length} سطر`);
  total += rows.length;
}

/* ── بررسی نهایی: تعداد سطرها باید دو طرف یکی باشد ── */

if (!DRY_RUN) {
  console.log("\nبررسی نهایی:");
  let mismatch = 0;
  for (const table of TABLES) {
    const a = await countOf(source, table);
    const b = await countOf(target, table);
    if (a !== b) {
      console.log(`  ✘ ${table}: مبدا ${a} — مقصد ${b}`);
      mismatch++;
    }
  }
  console.log(mismatch === 0 ? "  ✔ تعداد سطرها در همه‌ی جدول‌ها یکی است." : "");
  if (mismatch) process.exit(1);
}

console.log(`\nمجموع: ${total} سطر\n`);

await source.end();
await target.end();
