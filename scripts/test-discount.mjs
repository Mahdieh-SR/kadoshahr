/**
 * تست کد تخفیف — شامل تلاش‌های واقعی برای سوءاستفاده.
 * اجرا: node scripts/test-discount.mjs
 */
import "dotenv/config";
import { Client } from "pg";

const BASE = "http://localhost:3000";
const fa = new Intl.NumberFormat("fa-IR");
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

const randomPhone = (p = "0914") =>
  p + String(Math.floor(Math.random() * 1e7)).padStart(7, "0");

/* ── محصول تست ── */
const { rows: variants } = await db.query(
  // فقط نسخه‌ای که واقعاً در فروشگاه قابل خرید است
  `select v.id, v.price from "ProductVariant" v
     join "Product" p on p.id = v."productId"
    where v.stock > 5 and v."isActive" and p."isActive"
    order by v.price asc limit 1`
);
const variant = variants[0];
const items = [{ variantId: variant.id, quantity: 1 }];
const subtotal = variant.price;

console.log(`\nمبلغ سبد تست: ${fa.format(subtotal)} تومان\n`);

/* ── ساخت کدهای تست مستقیم در دیتابیس ── */
const stamp = Date.now();
const codes = {
  percent: `TEST20-${stamp}`.toUpperCase(),
  capped: `TESTCAP-${stamp}`.toUpperCase(),
  fixed: `TESTFIX-${stamp}`.toUpperCase(),
  expired: `TESTEXP-${stamp}`.toUpperCase(),
  future: `TESTFUT-${stamp}`.toUpperCase(),
  minimum: `TESTMIN-${stamp}`.toUpperCase(),
  exhausted: `TESTFULL-${stamp}`.toUpperCase(),
  inactive: `TESTOFF-${stamp}`.toUpperCase(),
  onceOnly: `TESTONCE-${stamp}`.toUpperCase(),
};

async function makeCode(code, extra = {}) {
  const cfg = {
    type: "PERCENT",
    value: 20,
    minOrderAmount: 0,
    maxDiscountAmount: 0,
    usageLimit: 0,
    usedCount: 0,
    perUserLimit: 1,
    startsAt: null,
    expiresAt: null,
    isActive: true,
    ...extra,
  };
  await db.query(
    `INSERT INTO "DiscountCode"
       ("id","code","type","value","minOrderAmount","maxDiscountAmount",
        "usageLimit","usedCount","perUserLimit","startsAt","expiresAt","isActive","updatedAt")
     VALUES (gen_random_uuid()::text,$1,$2::"DiscountType",$3,$4,$5,$6,$7,$8,$9,$10,$11,now())`,
    [
      code, cfg.type, cfg.value, cfg.minOrderAmount, cfg.maxDiscountAmount,
      cfg.usageLimit, cfg.usedCount, cfg.perUserLimit, cfg.startsAt,
      cfg.expiresAt, cfg.isActive,
    ]
  );
}

await makeCode(codes.percent, { value: 20 });
await makeCode(codes.capped, { value: 50, maxDiscountAmount: 100000 });
await makeCode(codes.fixed, { type: "FIXED", value: 200000 });
await makeCode(codes.expired, { expiresAt: new Date(Date.now() - 86400000) });
await makeCode(codes.future, { startsAt: new Date(Date.now() + 86400000) });
await makeCode(codes.minimum, { minOrderAmount: subtotal + 5_000_000 });
await makeCode(codes.exhausted, { usageLimit: 5, usedCount: 5 });
await makeCode(codes.inactive, { isActive: false });
await makeCode(codes.onceOnly, { type: "FIXED", value: 50000, perUserLimit: 1 });

const jar = await loginAs(randomPhone());

async function preview(code) {
  return fetch(`${BASE}/api/discount`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: jar.header() },
    body: JSON.stringify({ code, items }),
  }).then((r) => r.json());
}

/* ─── محاسبه‌ی درست ─── */
{
  const r = await preview(codes.percent);
  const expected = Math.floor(subtotal * 0.2);
  check(
    "تخفیف درصدی درست حساب می‌شود",
    r.ok && r.amount === expected,
    `۲۰٪ از ${fa.format(subtotal)} = ${fa.format(r.amount ?? 0)}`
  );
}
{
  const r = await preview(codes.capped);
  check(
    "سقف تخفیف رعایت می‌شود",
    r.ok && r.amount === 100000,
    `۵۰٪ با سقف ۱۰۰٬۰۰۰ → ${fa.format(r.amount ?? 0)}`
  );
}
{
  const r = await preview(codes.fixed);
  check(
    "تخفیف مبلغ ثابت درست است",
    r.ok && r.amount === 200000,
    `${fa.format(r.amount ?? 0)} تومان`
  );
}
{
  const r = await preview(codes.percent.toLowerCase());
  check("کد با حروف کوچک هم پذیرفته می‌شود", r.ok === true, r.error ?? "پذیرفته شد");
}

/* ─── کدهای نامعتبر ─── */
for (const [code, label] of [
  [codes.expired, "کد منقضی‌شده"],
  [codes.future, "کدی که هنوز شروع نشده"],
  [codes.minimum, "کد با حداقل مبلغ بالاتر از سبد"],
  [codes.exhausted, "کدی که ظرفیتش تمام شده"],
  [codes.inactive, "کد غیرفعال"],
  [`NOPE-${stamp}`, "کدی که اصلاً وجود ندارد"],
]) {
  const r = await preview(code);
  check(`🔒 رد می‌شود: ${label}`, r.ok === false, r.error);
}

/* ─── مبلغ سفارش با تخفیف ─── */
const address = {
  province: "تهران",
  city: "تهران",
  address: "خیابان آزادی، کوچه دوم، پلاک ۱۰",
  postalCode: "1345678901",
};

async function checkout(jarUsed, discountCode) {
  return fetch(`${BASE}/api/test/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: jarUsed.header() },
    body: JSON.stringify({
      firstName: "تست",
      lastName: "تخفیف",
      email: "t@example.com",
      ...address,
      items,
      discountCode,
    }),
  }).then((r) => r.json());
}

async function payFor(authority) {
  const res = await fetch(`${BASE}/api/mock-gateway/decide`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ authority, decision: "approve" }),
  });
  const next = res.headers.get("location");
  if (next) await fetch(new URL(next, BASE), { redirect: "manual" });
}

let paidOrderNumber;
{
  const r = await checkout(jar, codes.fixed);
  const authority = r.ok
    ? new URL(r.paymentUrl, BASE).searchParams.get("authority")
    : null;

  const { rows } = await db.query(
    'SELECT "subtotalAmount","discountAmount","totalAmount","discountCode" FROM "Order" WHERE "authority" = $1',
    [authority]
  );
  const o = rows[0];

  check(
    "مبلغ سفارش با تخفیف درست ذخیره شد",
    o &&
      o.subtotalAmount === subtotal &&
      o.discountAmount === 200000 &&
      o.totalAmount === subtotal - 200000,
    `${fa.format(o?.subtotalAmount)} − ${fa.format(o?.discountAmount)} = ${fa.format(o?.totalAmount)}`
  );

  paidOrderNumber = r.orderNumber;
  await payFor(authority);
}

/* ─── شمارش استفاده فقط بعد از پرداخت ─── */
{
  const { rows } = await db.query(
    'SELECT "usedCount" FROM "DiscountCode" WHERE code = $1',
    [codes.fixed]
  );
  check(
    "شمارنده‌ی استفاده بعد از پرداخت موفق زیاد شد",
    rows[0].usedCount === 1,
    `usedCount = ${rows[0].usedCount} (سفارش ${paidOrderNumber})`
  );
}
{
  // سفارشی که پرداخت نشده نباید ظرفیت کد را مصرف کند
  const r = await checkout(jar, codes.percent);
  const { rows } = await db.query(
    'SELECT "usedCount" FROM "DiscountCode" WHERE code = $1',
    [codes.percent]
  );
  check(
    "🔒 سفارش پرداخت‌نشده ظرفیت کد را مصرف نمی‌کند",
    r.ok === true && rows[0].usedCount === 0,
    `usedCount = ${rows[0].usedCount}`
  );
}

/* ─── سقف هر کاربر ─── */
{
  const r = await preview(codes.fixed);
  check(
    "🔒 کاربر نمی‌تواند از کد یک‌بارمصرف دوباره استفاده کند",
    r.ok === false,
    r.error
  );
}
{
  // ولی کاربر دیگری باید بتواند
  const otherJar = await loginAs(randomPhone("0915"));
  const r = await fetch(`${BASE}/api/discount`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: otherJar.header() },
    body: JSON.stringify({ code: codes.fixed, items }),
  }).then((r) => r.json());
  check("کاربر دیگر می‌تواند از همان کد استفاده کند", r.ok === true, r.error);
}

/* ─── تلاش‌های سوءاستفاده ─── */
{
  // کاربر مبلغ تخفیف دلخواه می‌فرستد
  const r = await fetch(`${BASE}/api/test/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: jar.header() },
    body: JSON.stringify({
      firstName: "تست", lastName: "تقلب", email: "t@example.com",
      ...address, items,
      discountCode: codes.percent,
      discountAmount: subtotal - 1000,
      totalAmount: 1000,
      subtotalAmount: 1000,
    }),
  }).then((r) => r.json());

  const authority = r.ok
    ? new URL(r.paymentUrl, BASE).searchParams.get("authority")
    : null;
  const { rows } = await db.query(
    'SELECT "discountAmount","totalAmount" FROM "Order" WHERE "authority" = $1',
    [authority]
  );

  check(
    "🔒 مبلغ تخفیف ارسالی از مرورگر نادیده گرفته می‌شود",
    rows[0]?.discountAmount === Math.floor(subtotal * 0.2),
    `کاربر ${fa.format(subtotal - 1000)} خواست، سرور ${fa.format(rows[0]?.discountAmount)} داد`
  );
}
{
  const r = await checkout(jar, codes.expired);
  check(
    "🔒 ثبت سفارش با کد منقضی متوقف می‌شود",
    r.ok === false,
    r.error
  );
}
{
  // بدون ورود نباید بشود کد را امتحان کرد
  const r = await fetch(`${BASE}/api/discount`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: codes.percent, items }),
  });
  check("🔒 بدون ورود نمی‌شود کد تخفیف امتحان کرد", r.status === 401);
}

/* ─── محافظت در برابر حدس زدن کد ─── */
{
  const guessJar = await loginAs(randomPhone("0916"));
  let blockedAt = null;
  for (let i = 1; i <= 20; i++) {
    const res = await fetch(`${BASE}/api/discount`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: guessJar.header() },
      body: JSON.stringify({ code: `GUESS${i}`, items }),
    });
    if (res.status === 429) {
      blockedAt = i;
      break;
    }
  }
  check(
    "🔒 حدس زدن پشت‌سرهم کد بلاک می‌شود",
    blockedAt !== null,
    blockedAt ? `از تلاش ${blockedAt}ام بلاک شد` : "بلاک نشد!"
  );
}

/* ─── محافظت در برابر ثبت ناقص (باگ واقعی که رخ داده بود) ─── */
{
  // سناریو: پرداخت موفق بوده و سفارش PAID شده، ولی رکورد جانبیِ ثبت استفاده
  // به دلیل کندی شبکه ساخته نشده. کاربر نباید بتواند دوباره از کد استفاده کند.
  const soloJar = await loginAs(randomPhone("0917"));
  const soloCode = `TESTGAP-${stamp}`.toUpperCase();
  await makeCode(soloCode, { type: "FIXED", value: 50000, perUserLimit: 1 });

  const first = await checkout(soloJar, soloCode);
  const auth1 = new URL(first.paymentUrl, BASE).searchParams.get("authority");
  await payFor(auth1);

  // رکورد جانبی را عمداً پاک می‌کنیم تا دقیقاً همان خرابی شبیه‌سازی شود
  const { rows: ord } = await db.query(
    'SELECT id FROM "Order" WHERE "authority" = $1',
    [auth1]
  );
  await db.query('DELETE FROM "DiscountRedemption" WHERE "orderId" = $1', [ord[0].id]);
  await db.query('UPDATE "DiscountCode" SET "usedCount" = 0 WHERE code = $1', [soloCode]);

  const retry = await fetch(`${BASE}/api/discount`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: soloJar.header() },
    body: JSON.stringify({ code: soloCode, items }),
  }).then((r) => r.json());

  check(
    "🔒 حتی با ثبت ناقص، استفاده‌ی دوم از کد بلاک می‌شود",
    retry.ok === false,
    retry.error ?? "اجازه داده شد!"
  );

  const secondOrder = await checkout(soloJar, soloCode);
  check(
    "🔒 ثبت سفارش دوم با همان کد هم متوقف می‌شود",
    secondOrder.ok === false,
    secondOrder.error
  );

  await db.query('DELETE FROM "Order" WHERE "authority" = $1', [auth1]);
}

/* ─── پاکسازی ─── */
await db.query('DELETE FROM "Order" WHERE "lastName" IN ($1,$2)', ["تخفیف", "تقلب"]);
await db.query('DELETE FROM "DiscountCode" WHERE code LIKE $1', [`%-${stamp}`]);
await db.query('DELETE FROM "RateLimit"');
await db.end();

const passed = results.filter((r) => r.passed).length;
console.log(`\n${passed} از ${results.length} تست موفق\n`);
process.exit(passed === results.length ? 0 : 1);
