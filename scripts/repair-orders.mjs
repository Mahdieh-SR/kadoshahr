/**
 * ترمیم سفارش‌های پرداخت‌شده‌ای که کارهای جانبی‌شان (کم شدن موجودی و
 * ثبت استفاده از کد تخفیف) به دلیل قطعی یا کندی شبکه ناقص مانده است.
 *
 * اجرا:  npm run orders:repair
 */
import "dotenv/config";
import { Client } from "pg";

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

const { rows: broken } = await db.query(`
  SELECT o.id, o."orderNumber", o."discountCodeId", o."discountAmount", o."userId"
    FROM "Order" o
   WHERE o.status IN ('PAID','DELIVERED')
     AND o."discountCodeId" IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM "DiscountRedemption" r WHERE r."orderId" = o.id)
`);

console.log(`\n${broken.length} سفارش با استفاده‌ی ثبت‌نشده‌ی کد تخفیف پیدا شد.`);

for (const o of broken) {
  await db.query(
    `INSERT INTO "DiscountRedemption" ("id","amount","codeId","userId","orderId","createdAt")
     VALUES (gen_random_uuid()::text,$1,$2,$3,$4,now())
     ON CONFLICT ("orderId") DO NOTHING`,
    [o.discountAmount, o.discountCodeId, o.userId, o.id]
  );
  console.log(`  ✔ ${o.orderNumber} — استفاده از کد ثبت شد`);
}

// شمارنده‌ی usedCount هر کد با واقعیت هماهنگ می‌شود
const { rows: codes } = await db.query(`
  UPDATE "DiscountCode" dc
     SET "usedCount" = sub.n
    FROM (
      SELECT "discountCodeId" AS id, COUNT(*)::int AS n
        FROM "Order"
       WHERE status IN ('PAID','DELIVERED') AND "discountCodeId" IS NOT NULL
       GROUP BY "discountCodeId"
    ) sub
   WHERE dc.id = sub.id AND dc."usedCount" <> sub.n
   RETURNING dc.code, dc."usedCount"
`);

for (const c of codes) {
  console.log(`  ✔ شمارنده‌ی ${c.code} اصلاح شد → ${c.usedCount}`);
}

// یادداشت هشدار ادمین که دیگر لازم نیست
const { rowCount: cleared } = await db.query(`
  UPDATE "Order" SET "deliveryNote" = NULL
   WHERE "deliveryNote" LIKE '⚠️ پرداخت موفق بود ولی%'
     AND EXISTS (SELECT 1 FROM "DiscountRedemption" r WHERE r."orderId" = "Order".id)
`);
if (cleared > 0) console.log(`  ✔ ${cleared} یادداشت هشدار پاک شد`);

console.log("\nترمیم تمام شد.\n");
await db.end();
