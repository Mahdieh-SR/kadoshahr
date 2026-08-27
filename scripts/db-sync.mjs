/**
 * ساخت/بازسازی جدول‌های دیتابیس.
 *
 * چرا به‌جای `prisma db push`؟
 * موتور Rust خط‌فرمان Prisma روی این شبکه نمی‌تواند به Neon وصل شود (خطای P1001)
 * در حالی که درایور Node بدون مشکل وصل می‌شود. پس SQL را به‌صورت آفلاین از روی
 * schema.prisma می‌سازیم و با همان درایوری اجرا می‌کنیم که خود سایت استفاده می‌کند.
 *
 * استفاده:
 *   node scripts/db-sync.mjs           → فقط اگر دیتابیس خالی باشد جدول‌ها را می‌سازد
 *   node scripts/db-sync.mjs --reset   → همه‌چیز را پاک و از نو می‌سازد (داده‌ها می‌روند)
 */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const root = process.cwd();
const sqlPath = join(root, "prisma", "init.sql");
const reset = process.argv.includes("--reset");

const connectionString = process.env.DATABASE_URL;
if (!connectionString || connectionString.includes("USER:PASSWORD")) {
  console.error("✖ DATABASE_URL در فایل .env تنظیم نشده است.");
  process.exit(1);
}

console.log("→ ساخت SQL از روی prisma/schema.prisma …");
execFileSync(
  "npx",
  [
    "prisma",
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema",
    "prisma/schema.prisma",
    "--script",
    "-o",
    "prisma/init.sql",
  ],
  // shell: true لازم است چون npx روی ویندوز یک فایل .cmd است، نه یک exe
  { stdio: "inherit", cwd: root, shell: true }
);

const sql = readFileSync(sqlPath, "utf8");
const client = new Client({ connectionString });

try {
  await client.connect();

  const { rows } = await client.query(
    `select count(*)::int as n from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE'`
  );
  const existingTables = rows[0].n;

  if (existingTables > 0 && !reset) {
    console.error(
      `\n✖ دیتابیس خالی نیست (${existingTables} جدول دارد).\n` +
        "  برای بازسازی کامل، این دستور را بزنید:  npm run db:reset\n" +
        "  ⚠️ توجه: تمام داده‌های موجود پاک می‌شود.\n"
    );
    process.exit(1);
  }

  if (reset && existingTables > 0) {
    console.log("→ پاک کردن جدول‌های قبلی …");
    await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  }

  console.log("→ اجرای SQL روی دیتابیس …");
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");

  const { rows: after } = await client.query(
    `select table_name from information_schema.tables
     where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`
  );

  console.log(`\n✔ ${after.length} جدول ساخته شد:`);
  console.log("  " + after.map((r) => r.table_name).join("، ") + "\n");
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("✖ خطا:", e.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
