/**
 * تست نظرات محصول — شامل تلاش برای ثبت نظر بدون خرید.
 * اجرا: node scripts/test-reviews.mjs
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

const randomPhone = (p = "0918") =>
  p + String(Math.floor(Math.random() * 1e7)).padStart(7, "0");

const { rows: vs } = await db.query(
  `select v.id as "variantId", v."productId", p.slug, p.title
     from "ProductVariant" v join "Product" p on p.id = v."productId"
    where v.stock > 3 order by v.price asc limit 1`
);
const target = vs[0];
const items = [{ variantId: target.variantId, quantity: 1 }];

console.log(`\nمحصول تست: ${target.title}\n`);

const address = {
  province: "تهران",
  city: "تهران",
  address: "خیابان آزادی، کوچه دوم، پلاک ۱۰",
  postalCode: "1345678901",
};

async function post(path, jar, body) {
  return fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: jar.header() },
    body: JSON.stringify(body),
  }).then((r) => r.json());
}

async function buy(jar) {
  const r = await post("/api/test/checkout", jar, {
    firstName: "تست", lastName: "نظر", email: "r@example.com",
    ...address, items,
  });
  const authority = new URL(r.paymentUrl, BASE).searchParams.get("authority");
  const res = await fetch(`${BASE}/api/mock-gateway/decide`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ authority, decision: "approve" }),
  });
  const next = res.headers.get("location");
  if (next) await fetch(new URL(next, BASE), { redirect: "manual" });
  return authority;
}

const goodComment = "کد رو سریع گرفتم و بدون مشکل فعال شد. ممنون از پشتیبانی.";

/* ─── ۱) بدون ورود ─── */
{
  const r = await fetch(`${BASE}/api/test/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productId: target.productId, rating: 5, comment: goodComment }),
  }).then((r) => r.json());
  check("🔒 بدون ورود نمی‌شود نظر ثبت کرد", r.ok === false, r.error);
}

/* ─── ۲) کاربری که نخریده ─── */
const nonBuyer = await loginAs(randomPhone("0918"));
{
  const r = await post("/api/test/review", nonBuyer, {
    productId: target.productId, rating: 5, comment: goodComment,
  });
  check("🔒 کسی که محصول را نخریده نمی‌تواند نظر بدهد", r.ok === false, r.error);
}

/* ─── ۳) خریدار واقعی ─── */
const buyer = await loginAs(randomPhone("0919"));
await buy(buyer);

{
  const r = await post("/api/test/review", buyer, {
    productId: target.productId, rating: 5, comment: goodComment,
  });
  check("خریدار می‌تواند نظر ثبت کند", r.ok === true, r.message ?? r.error);
}

/* ─── ۴) نظر تا تایید نشود نمایش داده نمی‌شود ─── */
{
  const res = await fetch(`${BASE}/product/${target.slug}`);
  const body = await res.text();
  check(
    "🔒 نظر تاییدنشده در سایت دیده نمی‌شود",
    !body.includes(goodComment),
    "در انتظار تایید مدیر"
  );
}

/* ─── ۵) نظر تکراری ─── */
{
  const r = await post("/api/test/review", buyer, {
    productId: target.productId, rating: 1, comment: "نظر دوم همان کاربر برای همان محصول.",
  });
  check("🔒 نظر دوم برای همان محصول رد می‌شود", r.ok === false, r.error);
}

/* ─── ۶) ورودی نامعتبر ─── */
const buyer2 = await loginAs(randomPhone("0921"));
await buy(buyer2);
{
  const r = await post("/api/test/review", buyer2, {
    productId: target.productId, rating: 9, comment: goodComment,
  });
  check("🔒 امتیاز خارج از بازه ۱ تا ۵ رد می‌شود", r.ok === false, r.error);
}
{
  const r = await post("/api/test/review", buyer2, {
    productId: target.productId, rating: 4, comment: "کوتاه",
  });
  check("🔒 نظر خیلی کوتاه رد می‌شود", r.ok === false, r.error);
}

/* ─── ۷) تایید توسط ادمین ─── */
const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE ?? "09120000000";
await db.query(`UPDATE "User" SET role = 'ADMIN' WHERE phone = $1`, [ADMIN_PHONE]);
const adminJar = await loginAs(ADMIN_PHONE);

const { rows: pending } = await db.query(
  `SELECT id FROM "Review" WHERE "productId" = $1 AND status = 'PENDING' LIMIT 1`,
  [target.productId]
);

{
  // اول کاربر عادی تلاش می‌کند
  const r = await post("/api/test/review", nonBuyer, {
    __action: "moderate", reviewId: pending[0].id, status: "APPROVED",
  });
  check("🔒 کاربر عادی نمی‌تواند نظر را تایید کند", r.ok === false, r.error);
}
{
  const r = await post("/api/test/review", adminJar, {
    __action: "moderate",
    reviewId: pending[0].id,
    status: "APPROVED",
    adminReply: "ممنون از خرید شما!",
  });
  check("ادمین نظر را تایید کرد", r.ok === true, r.message ?? r.error);
}

/* ─── ۸) بعد از تایید، در سایت دیده می‌شود ─── */
{
  const res = await fetch(`${BASE}/product/${target.slug}`);
  const body = await res.text();
  check("نظر تاییدشده در صفحه‌ی محصول دیده می‌شود", body.includes(goodComment));
}

/* ─── ۹) میانگین امتیاز محصول به‌روز شد ─── */
{
  const { rows } = await db.query(
    'SELECT "reviewCount","ratingSum" FROM "Product" WHERE id = $1',
    [target.productId]
  );
  check(
    "میانگین امتیاز محصول بازمحاسبه شد",
    rows[0].reviewCount === 1 && rows[0].ratingSum === 5,
    `${rows[0].reviewCount} نظر، مجموع امتیاز ${rows[0].ratingSum}`
  );
}

/* ─── ۱۰) رد کردن، امتیاز را برمی‌گرداند ─── */
{
  await post("/api/test/review", adminJar, {
    __action: "moderate", reviewId: pending[0].id, status: "REJECTED",
  });
  const { rows } = await db.query(
    'SELECT "reviewCount" FROM "Product" WHERE id = $1',
    [target.productId]
  );
  check(
    "رد کردن نظر، شمارنده را برمی‌گرداند",
    rows[0].reviewCount === 0,
    `تعداد نظر: ${rows[0].reviewCount}`
  );
}

/* ─── پاکسازی ─── */
await db.query('DELETE FROM "Review" WHERE "productId" = $1', [target.productId]);
await db.query('UPDATE "Product" SET "reviewCount"=0, "ratingSum"=0 WHERE id = $1', [target.productId]);
await db.query('DELETE FROM "Order" WHERE "lastName" = $1', ["نظر"]);
await db.query('DELETE FROM "RateLimit"');
await db.end();

const passed = results.filter((r) => r.passed).length;
console.log(`\n${passed} از ${results.length} تست موفق\n`);
process.exit(passed === results.length ? 0 : 1);
