/**
 * تست قیمت‌گذاری دلاری:
 * دسترسی، اعتبارسنجی، کمربند ایمنی جهش نرخ، درستی محاسبه، و اینکه
 * قیمت دلاری از فرم پذیرفته نمی‌شود (سرور خودش حساب می‌کند).
 *
 * اجرا: node scripts/test-pricing.mjs
 */
import "dotenv/config";
import { Client } from "pg";

const BASE = "http://localhost:3000";
const results = [];

function check(name, passed, detail = "") {
  results.push({ passed });
  console.log(`${passed ? "✔" : "✘"} ${name}${detail ? `\n     ${detail}` : ""}`);
}

function makeJar() {
  const jar = new Map();
  return {
    header: () => [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb(res) {
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(";");
        const i = pair.indexOf("=");
        if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
      }
    },
  };
}

async function connectWithRetry(attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    const c = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await c.connect();
      return c;
    } catch (e) {
      await c.end().catch(() => {});
      if (i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
}

const db = await connectWithRetry();
await db.query('DELETE FROM "RateLimit"');

async function loginAs(phone) {
  await db.query('DELETE FROM "OtpCode" WHERE phone = $1', [phone]);
  await db.query('DELETE FROM "RateLimit"');

  const otp = await (
    await fetch(`${BASE}/api/auth/otp/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    })
  ).json();

  const jar = makeJar();
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  jar.absorb(csrfRes);
  const { csrfToken } = await csrfRes.json();

  const res = await fetch(`${BASE}/api/auth/callback/otp`, {
    method: "POST",
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      cookie: jar.header(),
    },
    body: new URLSearchParams({
      csrfToken, phone, code: otp.devCode, callbackUrl: BASE, json: "true",
    }),
  });
  jar.absorb(res);
  return jar;
}

const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE ?? "09120000000";
await db.query(`UPDATE "User" SET role = 'ADMIN' WHERE phone = $1`, [ADMIN_PHONE]);

const adminJar = await loginAs(ADMIN_PHONE);
const userJar = await loginAs("0913" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0"));

const post = (jar, path, payload) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: jar.header() },
    body: JSON.stringify(payload),
  }).then((r) => r.json());

const setRate = (jar, payload) => post(jar, "/api/test/pricing", payload);
const saveProduct = (jar, payload) => post(jar, "/api/test/admin-product", payload);

/** وضعیت اولیه را برمی‌گردانیم تا تست، تنظیمات واقعی را خراب نکند */
const { rows: before } = await db.query(
  `SELECT "usdRate","marginPercent","roundTo" FROM "PricingSettings" WHERE id = 1`
);
const original = before[0] ?? { usdRate: 0, marginPercent: 0, roundTo: 1000 };

/* ─── ۱) کاربر عادی نباید بتواند نرخ را عوض کند ─── */
{
  const r = await setRate(userJar, { usdRate: 500000, marginPercent: 0, roundTo: 1000 });
  check("🔒 کاربر عادی نمی‌تواند نرخ دلار را تغییر دهد", r.ok === false, r.error);
}

/* ─── ۲) نرخ بی‌معنی رد می‌شود ─── */
{
  const r = await setRate(adminJar, { usdRate: 5, marginPercent: 0, roundTo: 1000 });
  check("🔒 نرخ کمتر از حد مجاز رد می‌شود", r.ok === false, r.error);
}
{
  const r = await setRate(adminJar, { usdRate: 100000, marginPercent: 500, roundTo: 1000 });
  check("🔒 درصد سود بیش از ۱۰۰ رد می‌شود", r.ok === false, r.error);
}

/* ─── ۳) ادمین نرخ پایه را تنظیم می‌کند ─── */
const RATE = 100000;
{
  const r = await setRate(adminJar, {
    usdRate: RATE, marginPercent: 0, roundTo: 1000, confirmJump: true,
  });
  check("ادمین نرخ دلار را تنظیم کرد", r.ok === true, r.message ?? r.error);
}

/* ─── ۴) ساخت محصول با قیمت دلاری ─── */
const slug = `test-usd-${Date.now()}`;
const { rows: cats } = await db.query('SELECT id FROM "Category" LIMIT 1');

const usdProduct = {
  title: "محصول تستی دلاری",
  slug,
  description: "این محصول توسط اسکریپت تست ساخته شده است و بعداً حذف می‌شود.",
  categoryId: cats[0].id,
  images: [],
  isActive: true,
  isFeatured: false,
  specs: [],
  variants: [
    {
      label: "Steam — آمریکا — ۱۰ دلاری",
      platform: "Steam",
      region: "آمریکا",
      capacity: "۱۰ دلاری",
      // ⚠️ عمداً یک قیمت تومانی مسخره فرستاده می‌شود تا ثابت شود
      // سرور آن را دور می‌ریزد و خودش از روی دلار حساب می‌کند.
      price: 1000,
      compareAtPrice: null,
      usdPriced: true,
      priceUsd: 1000, // ۱۰ دلار
      compareAtUsd: 1200, // ۱۲ دلار
      stock: 5,
      isActive: true,
    },
  ],
};

let productId = null;
{
  const r = await saveProduct(adminJar, usdProduct);
  productId = r.id ?? null;
  check("محصول با قیمت دلاری ساخته شد", r.ok === true, r.message ?? r.error);
}

const readVariant = async () => {
  const { rows } = await db.query(
    `SELECT v.price, v."compareAtPrice", v."priceUsd", v."usdPriced"
       FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
      WHERE p.slug = $1`,
    [slug]
  );
  return rows[0];
};

/* ─── ۵) قیمت تومانی فرستاده‌شده از کلاینت نادیده گرفته می‌شود ─── */
{
  const v = await readVariant();
  // ۱۰ دلار × ۱۰۰٬۰۰۰ = ۱٬۰۰۰٬۰۰۰ تومان
  check(
    "🔒 قیمت تومانیِ ارسالی کلاینت نادیده گرفته شد",
    v?.price === 1_000_000,
    `قیمت ذخیره‌شده: ${v?.price} (فرستاده شده بود: 1000)`
  );
  check(
    "قیمت قبل از تخفیف هم از دلار حساب شد",
    v?.compareAtPrice === 1_200_000,
    `مقدار: ${v?.compareAtPrice}`
  );
}

/* ─── ۶) کمربند ایمنی جهش نرخ ─── */
{
  const r = await setRate(adminJar, {
    usdRate: RATE * 10, marginPercent: 0, roundTo: 1000,
  });
  check(
    "🔒 جهش بزرگ نرخ بدون تایید اعمال نمی‌شود",
    r.ok === false && r.needsConfirm === true,
    r.error
  );

  const v = await readVariant();
  check("قیمت‌ها بعد از رد شدن جهش دست‌نخورده ماندند", v?.price === 1_000_000, `قیمت: ${v?.price}`);
}

/* ─── ۷) تغییر نرخ، قیمت‌ها را بازنویسی می‌کند ─── */
{
  const r = await setRate(adminJar, {
    usdRate: 120000, marginPercent: 0, roundTo: 1000, confirmJump: true,
  });
  check("نرخ جدید با تایید صریح اعمال شد", r.ok === true, r.message ?? r.error);

  const v = await readVariant();
  check(
    "قیمت محصول دلاری با نرخ جدید بازنویسی شد",
    v?.price === 1_200_000,
    `انتظار ۱٬۲۰۰٬۰۰۰ بود، الان ${v?.price}`
  );
}

/* ─── ۸) درصد سود روی قیمت اعمال می‌شود ─── */
{
  await setRate(adminJar, {
    usdRate: 100000, marginPercent: 10, roundTo: 1000, confirmJump: true,
  });
  const v = await readVariant();
  // ۱۰ دلار × ۱۰۰٬۰۰۰ × ۱.۱ = ۱٬۱۰۰٬۰۰۰
  check("درصد سود در قیمت لحاظ شد", v?.price === 1_100_000, `قیمت: ${v?.price}`);
}

/* ─── ۹) رند کردن همیشه به بالا ─── */
{
  await setRate(adminJar, {
    usdRate: 100001, marginPercent: 0, roundTo: 10000, confirmJump: true,
  });
  const v = await readVariant();
  // ۱۰ × ۱۰۰٬۰۰۱ = ۱٬۰۰۰٬۰۱۰ → رند به بالا تا مضرب ۱۰٬۰۰۰ = ۱٬۰۱۰٬۰۰۰
  check("قیمت به بالا رند شد", v?.price === 1_010_000, `قیمت: ${v?.price}`);
}

/* ─── ۱۰) نسخه‌ی تومانی با تغییر نرخ دست نمی‌خورد ─── */
{
  const { rows } = await db.query(
    `SELECT price FROM "ProductVariant" WHERE "usdPriced" = false ORDER BY price DESC LIMIT 1`
  );
  const fixedBefore = rows[0]?.price ?? null;

  await setRate(adminJar, {
    usdRate: 100000, marginPercent: 0, roundTo: 1000, confirmJump: true,
  });

  const { rows: after } = await db.query(
    `SELECT price FROM "ProductVariant" WHERE "usdPriced" = false ORDER BY price DESC LIMIT 1`
  );
  check(
    "نسخه‌های تومانی با تغییر نرخ عوض نشدند",
    fixedBefore !== null && after[0]?.price === fixedBefore,
    `قبل ${fixedBefore} / بعد ${after[0]?.price}`
  );
}

/* ─── ۱۱) گرفتن نرخ روز، هیچ قیمتی را عوض نمی‌کند ─── */
{
  const v1 = await readVariant();
  const r = await setRate(adminJar, { __action: "refresh" });
  const v2 = await readVariant();

  // اگر سرویس بیرونی در دسترس نباشد هم نباید چیزی خراب شود
  check(
    "گرفتن نرخ روز هیچ قیمتی را تغییر نداد",
    v1?.price === v2?.price,
    r.ok ? `نرخ پیشنهادی: ${r.rate}` : `سرویس در دسترس نبود: ${r.error}`
  );
}

/* ─── پاک‌سازی ─── */
if (productId) {
  await saveProduct(adminJar, { __action: "delete", id: productId });
}
await db.query(
  `UPDATE "PricingSettings" SET "usdRate" = $1, "marginPercent" = $2, "roundTo" = $3 WHERE id = 1`,
  [original.usdRate, original.marginPercent, original.roundTo]
);

const passed = results.filter((r) => r.passed).length;
console.log(`\n${passed} از ${results.length} تست موفق\n`);

await db.end();
process.exit(passed === results.length ? 0 : 1);
