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

  /**
   * جدول‌هایی که خودمان ساخته‌ایم — یعنی هر جدول public که **عضو یک افزونه
   * نباشد** (`pg_depend.deptype = 'e'` یعنی این شیء متعلق به یک extension است).
   *
   * چرا این‌قدر دقیق؟ چون Postgres سرویس‌های ابری معمولاً افزونه‌هایی مثل
   * PostGIS از پیش نصب دارد و آن‌ها جدول‌های واقعی خودشان را در public
   * می‌سازند (`spatial_ref_sys` با ۸۵۰۰ سطر). با شمارش ساده، دیتابیسِ تازه و
   * دست‌نخورده «پر» به نظر می‌رسید و این اسکریپت کار نمی‌کرد.
   */
  const ownTablesQuery = `
    select t.table_name
      from information_schema.tables t
     where t.table_schema = 'public'
       and t.table_type = 'BASE TABLE'
       and not exists (
         select 1
           from pg_depend d
           join pg_class c on c.oid = d.objid
           join pg_namespace ns on ns.oid = c.relnamespace
          where ns.nspname = 'public'
            and c.relname = t.table_name
            and d.deptype = 'e'
       )
     order by t.table_name`;

  const { rows: own } = await client.query(ownTablesQuery);
  const existingTables = own.length;

  if (existingTables > 0 && !reset) {
    console.error(
      `\n✖ دیتابیس خالی نیست (${existingTables} جدول دارد):\n` +
        "  " + own.map((r) => r.table_name).join("، ") + "\n\n" +
        "  برای بازسازی کامل، این دستور را بزنید:  npm run db:reset\n" +
        "  ⚠️ توجه: تمام داده‌های موجود پاک می‌شود.\n"
    );
    process.exit(1);
  }

  if (reset) {
    // فقط چیزهای خودمان، نه کل schema — وگرنه افزونه‌هایی که سرویس ابری نصب
    // کرده (PostGIS و مانندش) هم با DROP SCHEMA از بین می‌رفتند.
    if (existingTables > 0) {
      console.log(`→ پاک کردن ${existingTables} جدول قبلی …`);
      const list = own.map((r) => `"${r.table_name.replace(/"/g, '""')}"`).join(", ");
      await client.query(`DROP TABLE IF EXISTS ${list} CASCADE`);
    }

    // enum ها با DROP TABLE از بین نمی‌روند و اگر بمانند، اجرای دوباره‌ی
    // init.sql با خطای «type already exists» رد می‌شود.
    const { rows: enums } = await client.query(`
      select t.typname
        from pg_type t
        join pg_namespace ns on ns.oid = t.typnamespace
       where ns.nspname = 'public'
         and t.typtype = 'e'
         and not exists (
           select 1 from pg_depend d
            where d.objid = t.oid and d.deptype = 'e'
         )`);

    if (enums.length > 0) {
      console.log(`→ پاک کردن ${enums.length} نوع enum قبلی …`);
      const list = enums.map((r) => `"${r.typname.replace(/"/g, '""')}"`).join(", ");
      await client.query(`DROP TYPE IF EXISTS ${list} CASCADE`);
    }
  }

  console.log("→ اجرای SQL روی دیتابیس …");
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");

  const { rows: after } = await client.query(ownTablesQuery);

  console.log(`\n✔ ${after.length} جدول ساخته شد:`);
  console.log("  " + after.map((r) => r.table_name).join("، ") + "\n");
} catch (e) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("✖ خطا:", e.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
