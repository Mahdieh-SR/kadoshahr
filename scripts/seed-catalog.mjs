/**
 * اعمال فهرست واقعی محصولات از prisma/real-catalog.mjs روی دیتابیس.
 *
 * برخلاف `npm run db:seed` که همه چیز را پاک می‌کند، این اسکریپت **هیچ چیزی
 * را حذف نمی‌کند**.
 *
 * ⚠️ به‌طور پیش‌فرض فقط چیزهای **نبوده** را می‌سازد و به محصول موجود دست
 * نمی‌زند. دلیلش این است که این فایل کاتالوگ منبع حقیقت نیست — مدیر بعد از
 * اجرای اسکریپت در پنل عنوان و قیمت و موجودی را عوض می‌کند، و اجرای دوباره‌ی
 * اسکریپت آن ویرایش‌ها را بی‌صدا دور می‌ریخت. اگر واقعاً می‌خواهی فایل
 * کاتالوگ روی دیتابیس بنشیند، باید صریح `--overwrite` بدهی.
 *
 *   بدون فلگ:
 *     • محصول/نسخه‌ی نبوده  → ساخته می‌شود
 *     • محصول موجود         → کاملاً دست‌نخورده می‌ماند
 *     • محصول خارج از فهرست → دست‌نخورده می‌ماند
 *
 *   با --overwrite:
 *     • محصول موجود         → عنوان، توضیحات، تصاویر، وضعیت و نسخه‌هایش از
 *                             روی فایل بازنویسی می‌شود (ویرایش پنل می‌پرد)
 *     • محصول خارج از فهرست → بایگانی می‌شود (slug به legacy-… و پنهان)
 *     • نسخه‌ی خارج از فهرست → فقط غیرفعال می‌شود، تا سابقه‌ی سفارش‌های
 *                             قبلی مشتری‌ها سالم بماند
 *
 * می‌شود چند بار اجرایش کرد؛ نتیجه همیشه یکی است.
 *
 * اجرا:
 *   npm run catalog:apply -- --dry-run     فقط گزارش، بدون تغییر
 *   npm run catalog:apply                  فقط ساختن محصولات نبوده
 *   npm run catalog:apply -- --overwrite   بازنویسی محصولات موجود از روی فایل
 */
import "dotenv/config";
import { join } from "node:path";
import { Client } from "pg";
import { categories, products } from "../prisma/real-catalog.mjs";
import { writeImages } from "./lib/product-art.mjs";

const DRY_RUN = process.argv.includes("--dry-run");

/**
 * فقط با این فلگ اجازه دارد محصول موجود را بازنویسی و محصول خارج از فهرست را
 * بایگانی کند. بدون آن، هرچه در پنل ادمین ویرایش شده دست‌نخورده می‌ماند.
 */
const OVERWRITE = process.argv.includes("--overwrite");

/* ────────────────────────── کمک‌کارها ────────────────────────── */

const key = (...parts) =>
  parts
    .map((p) =>
      String(p ?? "")
        .replace(/‌/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase()
    )
    .join("¦");

function die(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

const OPTION_AXES = ["platform", "region", "capacity"];

/**
 * `{capacity: "مدت زمان", platform: "پلن"}` → `[{axis,label}, …]`
 *
 * چرا تبدیل؟ ترتیب کلیدهای شیء در جاوااسکریپت حفظ می‌شود ولی JSONB در
 * پستگرس آن را به هم می‌ریزد. آرایه ترتیبش را نگه می‌دارد، و ترتیب همان
 * چیزی است که مشتری در صفحه می‌بیند.
 */
function toOptionLabels(options) {
  if (!options) return [];
  return Object.entries(options)
    .filter(([axis, label]) => OPTION_AXES.includes(axis) && label)
    .map(([axis, label]) => ({ axis, label }));
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) die("DATABASE_URL در فایل .env تنظیم نشده است.");

const db = new Client({ connectionString });
await db.connect();

/* ────────────────────────── نرخ دلار ────────────────────────── */

const { rows: pricingRows } = await db.query(
  `SELECT "usdRate", "marginPercent", "roundTo" FROM "PricingSettings" WHERE id = 1`
);
const pricing = pricingRows[0] ?? { usdRate: 0, marginPercent: 0, roundTo: 1000 };

/** همان فرمول src/lib/exchange-rate.ts — رند همیشه به بالا */
function tomanFromUsd(cents) {
  const step = pricing.roundTo > 0 ? Math.floor(pricing.roundTo) : 1;
  const raw = (cents * pricing.usdRate * (100 + pricing.marginPercent)) / 10000;
  return Math.max(1000, Math.ceil(raw / step) * step);
}

const needsUsd = products.some((p) => p.variants.some((v) => v.usd));
if (needsUsd && pricing.usdRate <= 0) {
  die(
    "برای محصولات دلاری اول باید نرخ دلار تنظیم شود.\n" +
      "  پنل ادمین → نرخ دلار، یا مستقیم در جدول PricingSettings."
  );
}

console.log(
  `\nنرخ دلار: ${pricing.usdRate.toLocaleString("fa-IR")} تومان` +
    (pricing.marginPercent ? ` + ${pricing.marginPercent}٪ سود` : "") +
    `\n`
);

/* ────────────────────────── دسته‌بندی‌ها ────────────────────────── */

const categoryIds = new Map();
let sortOrder = 0;

for (const c of categories) {
  const { rows } = await db.query(`SELECT id FROM "Category" WHERE slug = $1`, [c.slug]);

  if (rows[0]) {
    if (!DRY_RUN) {
      await db.query(
        `UPDATE "Category" SET name = $1, icon = $2, "sortOrder" = $3 WHERE id = $4`,
        [c.name, c.icon, sortOrder, rows[0].id]
      );
    }
    categoryIds.set(c.slug, rows[0].id);
    console.log(`  ↻ دسته: ${c.name}`);
  } else {
    if (DRY_RUN) {
      categoryIds.set(c.slug, `dry-${c.slug}`);
    } else {
      const { rows: created } = await db.query(
        `INSERT INTO "Category" (id, name, slug, icon, "sortOrder", "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, now()) RETURNING id`,
        [c.name, c.slug, c.icon, sortOrder]
      );
      categoryIds.set(c.slug, created[0].id);
    }
    console.log(`  ＋ دسته: ${c.name}`);
  }
  sortOrder++;
}

/* ────────────────────────── محصول‌ها ────────────────────────── */

const wanted = new Set(products.map((p) => p.slug));
const stats = { created: 0, updated: 0, skipped: 0, archived: 0, newVariants: 0, offVariants: 0 };

console.log("");

for (const p of products) {
  const categoryId = categoryIds.get(p.category);
  if (!categoryId) die(`دسته‌بندی «${p.category}» برای محصول «${p.slug}» تعریف نشده است.`);

  const { rows: existing } = await db.query(`SELECT id FROM "Product" WHERE slug = $1`, [p.slug]);
  let productId = existing[0]?.id ?? null;

  // محصولی که قبلاً ساخته شده ممکن است در پنل ادمین ویرایش شده باشد؛ بدون
  // --overwrite حتی تصویرهایش هم دوباره نوشته نمی‌شود.
  if (productId && !OVERWRITE) {
    stats.skipped++;
    console.log(`  = ${p.title}`);
    continue;
  }

  const images = writeImages(p, { dryRun: DRY_RUN });

  // «نکات مهم» به انتهای توضیحات اضافه می‌شود تا در تب توضیحات دیده شود
  const description =
    p.description +
    (p.notes?.length ? `\n\nنکات مهم پیش از خرید:\n` + p.notes.map((n) => `• ${n}`).join("\n") : "");

  if (productId) {
    if (!DRY_RUN) {
      await db.query(
        `UPDATE "Product"
            SET title = $1, description = $2, specs = $3::jsonb, "optionLabels" = $4::jsonb,
                images = $5::text[], "isActive" = true, "isFeatured" = $6,
                "categoryId" = $7, "updatedAt" = now()
          WHERE id = $8`,
        [
          p.title,
          description,
          JSON.stringify(p.specs ?? []),
          JSON.stringify(toOptionLabels(p.options)),
          images,
          Boolean(p.featured),
          categoryId,
          productId,
        ]
      );
    }
    stats.updated++;
  } else {
    if (!DRY_RUN) {
      const { rows: created } = await db.query(
        `INSERT INTO "Product"
           (id, title, slug, description, specs, "optionLabels", images,
            "isActive", "isFeatured", "categoryId", "createdAt", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4::jsonb, $5::jsonb, $6::text[],
                 true, $7, $8, now(), now())
         RETURNING id`,
        [
          p.title,
          p.slug,
          description,
          JSON.stringify(p.specs ?? []),
          JSON.stringify(toOptionLabels(p.options)),
          images,
          Boolean(p.featured),
          categoryId,
        ]
      );
      productId = created[0].id;
    }
    stats.created++;
  }

  /* ── نسخه‌ها ── */
  const { rows: currentVariants } = productId
    ? await db.query(
        `SELECT id, platform, region, capacity, "isActive" FROM "ProductVariant" WHERE "productId" = $1`,
        [productId]
      )
    : { rows: [] };

  const byKey = new Map(currentVariants.map((v) => [key(v.platform, v.region, v.capacity), v]));
  const seen = new Set();

  for (const v of p.variants) {
    const k = key(v.platform, v.region, v.capacity);
    seen.add(k);

    const usdCents = v.usd ? Math.round(v.usd * 100) : null;
    const price = usdCents ? tomanFromUsd(usdCents) : v.toman;
    const compareUsd = v.compareUsd ? Math.round(v.compareUsd * 100) : null;
    const compareAt = compareUsd ? tomanFromUsd(compareUsd) : (v.compareToman ?? null);

    const values = [
      `${v.platform} — ${v.region} — ${v.capacity}`,
      v.platform,
      v.region,
      v.capacity,
      price,
      compareAt,
      usdCents,
      compareUsd,
      Boolean(usdCents),
      v.stock ?? 0,
      // «ناموجود» با موجودی صفر نشان داده می‌شود، نه با غیرفعال کردن نسخه —
      // وگرنه کادرهای انتخاب محصول کلاً ناپدید می‌شدند و صفحه خالی می‌شد.
      v.isActive ?? true,
    ];

    const found = byKey.get(k);
    if (found) {
      if (!DRY_RUN) {
        await db.query(
          `UPDATE "ProductVariant"
              SET label = $1, platform = $2, region = $3, capacity = $4, price = $5,
                  "compareAtPrice" = $6, "priceUsd" = $7, "compareAtUsd" = $8,
                  "usdPriced" = $9, stock = $10, "isActive" = $11
            WHERE id = $12`,
          [...values, found.id]
        );
      }
    } else {
      if (!DRY_RUN) {
        await db.query(
          `INSERT INTO "ProductVariant"
             (id, label, platform, region, capacity, price, "compareAtPrice",
              "priceUsd", "compareAtUsd", "usdPriced", stock, "isActive", "productId")
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [...values, productId]
        );
      }
      stats.newVariants++;
    }
  }

  // نسخه‌های قدیمی حذف نمی‌شوند — فقط پنهان، تا سفارش‌های قبلی خراب نشوند
  for (const [k, v] of byKey) {
    if (seen.has(k) || !v.isActive) continue;
    if (!DRY_RUN) {
      await db.query(`UPDATE "ProductVariant" SET "isActive" = false WHERE id = $1`, [v.id]);
    }
    stats.offVariants++;
  }

  console.log(`  ${existing[0] ? "↻" : "＋"} ${p.title}`);
}

/* ────────────────────────── بایگانی محصولات قدیمی ────────────────────────── */

const { rows: leftovers } = OVERWRITE
  ? await db.query(`SELECT id, slug, title FROM "Product" WHERE slug NOT LIKE 'legacy-%'`)
  : { rows: [] };

// ⚠️ بدون --overwrite اینجا خالی می‌ماند. محصولی که مدیر خودش در پنل ساخته
// در فایل کاتالوگ نیست، و بایگانی کردنش یعنی محصول تازه‌ساخته‌ی او پنهان شود.
const toArchive = leftovers.filter((p) => !wanted.has(p.slug));

if (toArchive.length) {
  console.log("\nبایگانی محصولات نمونه‌ی قدیمی (حذف نمی‌شوند، فقط پنهان):");
  for (const p of toArchive) {
    if (!DRY_RUN) {
      await db.query(
        `UPDATE "Product"
            SET slug = $1, "isActive" = false, "isFeatured" = false, "updatedAt" = now()
          WHERE id = $2`,
        [`legacy-${p.slug}`, p.id]
      );
      await db.query(`UPDATE "ProductVariant" SET "isActive" = false WHERE "productId" = $1`, [
        p.id,
      ]);
    }
    console.log(`  ⤵ ${p.title}`);
    stats.archived++;
  }
}

/* ────────────────────────── گزارش ────────────────────────── */

console.log(
  `\n${DRY_RUN ? "— حالت بررسی، هیچ تغییری داده نشد —\n" : ""}` +
    `محصول جدید: ${stats.created}   ·   بازنویسی‌شده: ${stats.updated}   ·   ` +
    `دست‌نخورده: ${stats.skipped}   ·   بایگانی‌شده: ${stats.archived}\n` +
    `نسخه‌ی جدید: ${stats.newVariants}   ·   نسخه‌ی پنهان‌شده: ${stats.offVariants}\n`
);

if (stats.skipped && !OVERWRITE) {
  console.log(
    `ℹ️  ${stats.skipped} محصول از قبل وجود داشت و دست‌نخورده ماند، تا ویرایش‌های\n` +
      `   پنل ادمین (عنوان، قیمت، موجودی) از بین نرود.\n` +
      `   اگر عمداً می‌خواهی فایل کاتالوگ روی آن‌ها بنشیند:\n` +
      `   npm run catalog:apply -- --overwrite\n`
  );
}

if (!DRY_RUN) {
  console.log("   فروشگاه:  http://localhost:3000/products\n");
}

await db.end();
