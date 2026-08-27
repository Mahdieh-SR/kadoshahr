/**
 * اجرای مهاجرت‌های دیتابیس.
 *
 * فایل‌های SQL داخل prisma/sql/ به ترتیب نام اجرا می‌شوند و هر کدام فقط
 * یک بار اعمال می‌شود (سابقه در جدول _migrations نگه داشته می‌شود).
 *
 * چرا دستی؟ چون ابزار مهاجرت خود Prisma روی این شبکه به Neon وصل نمی‌شود.
 * این روش همان کار را می‌کند و داده‌های موجود را هم پاک نمی‌کند.
 *
 * استفاده:
 *   npm run db:migrate            → مهاجرت‌های اعمال‌نشده را اجرا می‌کند
 *   npm run db:migrate -- --status → فقط وضعیت را نشان می‌دهد
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const sqlDir = join(process.cwd(), "prisma", "sql");
const statusOnly = process.argv.includes("--status");

const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString.includes("USER:PASSWORD")) {
  console.error("✖ DATABASE_URL در فایل .env تنظیم نشده است.");
  process.exit(1);
}

const files = readdirSync(sqlDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const db = new Client({ connectionString });
await db.connect();

try {
  await db.query(`
    CREATE TABLE IF NOT EXISTS "_migrations" (
      "name"       TEXT PRIMARY KEY,
      "appliedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const { rows } = await db.query('SELECT "name" FROM "_migrations"');
  const applied = new Set(rows.map((r) => r.name));

  // اگر دیتابیس از قبل جدول‌ها را دارد ولی سابقه‌ای ثبت نشده، اولین مهاجرت
  // (ساخت اولیه) را «قبلاً اعمال‌شده» در نظر می‌گیریم تا دوباره اجرا نشود.
  if (applied.size === 0 && files.length > 0) {
    const { rows: existing } = await db.query(
      `SELECT count(*)::int AS n FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'Product'`
    );
    if (existing[0].n > 0) {
      await db.query('INSERT INTO "_migrations" ("name") VALUES ($1)', [files[0]]);
      applied.add(files[0]);
      console.log(`(${files[0]} به‌عنوان مبنا ثبت شد — جدول‌ها از قبل وجود داشتند)`);
    }
  }

  const pending = files.filter((f) => !applied.has(f));

  if (statusOnly) {
    console.log("\nوضعیت مهاجرت‌ها:");
    for (const f of files) {
      console.log(`  ${applied.has(f) ? "✔ اعمال‌شده" : "· در انتظار"}  ${f}`);
    }
    console.log("");
    process.exit(0);
  }

  if (pending.length === 0) {
    console.log("✔ دیتابیس به‌روز است؛ مهاجرت جدیدی وجود ندارد.");
    process.exit(0);
  }

  for (const file of pending) {
    const sql = readFileSync(join(sqlDir, file), "utf8");
    console.log(`→ اجرای ${file} …`);
    await db.query("BEGIN");
    try {
      await db.query(sql);
      await db.query('INSERT INTO "_migrations" ("name") VALUES ($1)', [file]);
      await db.query("COMMIT");
      console.log(`  ✔ ${file}`);
    } catch (e) {
      await db.query("ROLLBACK");
      throw new Error(`مهاجرت ${file} شکست خورد: ${e.message}`);
    }
  }

  console.log(`\n✔ ${pending.length} مهاجرت اعمال شد.\n`);
} catch (e) {
  console.error("✖ خطا:", e.message);
  process.exit(1);
} finally {
  await db.end().catch(() => {});
}
