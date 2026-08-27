/**
 * تست آدرس پستی — شامل تلاش برای دور زدن اعتبارسنجی از راه API.
 * اجرا: node scripts/test-address.mjs
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

async function loginNewUser() {
  const phone = "0912" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
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
  return { jar, phone };
}

const { rows: variants } = await db.query(
  `select id from "ProductVariant" where stock > 3 limit 1`
);
const variantId = variants[0].id;

async function tryCheckout(jar, address) {
  const res = await fetch(`${BASE}/api/test/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: jar.header() },
    body: JSON.stringify({
      firstName: "مهدیه",
      lastName: "رایانه",
      email: "test@example.com",
      items: [{ variantId, quantity: 1 }],
      ...address,
    }),
  });
  return res.json();
}

const validAddress = {
  province: "تهران",
  city: "ورامین",
  address: "خیابان شریعتی، کوچه بهار، پلاک ۱۲، واحد ۳",
  postalCode: "3371956241",
};

const { jar } = await loginNewUser();

// ── تلاش‌های نامعتبر ──
const badCases = [
  ["بدون آدرس اصلاً", {}],
  ["استان جعلی", { ...validAddress, province: "استان خیالی" }],
  ["شهری که در آن استان نیست", { ...validAddress, province: "تهران", city: "شیراز" }],
  ["کد پستی ۵ رقمی", { ...validAddress, postalCode: "12345" }],
  ["کد پستی با ۱۰ رقم یکسان", { ...validAddress, postalCode: "1111111111" }],
  ["نشانی خیلی کوتاه", { ...validAddress, address: "تهران" }],
];

for (const [label, address] of badCases) {
  const r = await tryCheckout(jar, address);
  check(`🔒 رد می‌شود: ${label}`, r.ok === false, r.error);
}

// ── ارقام فارسی در کد پستی باید پذیرفته شود ──
{
  const r = await tryCheckout(jar, { ...validAddress, postalCode: "۳۳۷۱۹۵۶۲۴۱" });
  check("کد پستی با ارقام فارسی پذیرفته می‌شود", r.ok === true, r.error ?? "ثبت شد");
}

// ── آدرس معتبر باید روی سفارش و پروفایل ذخیره شود ──
{
  const r = await tryCheckout(jar, validAddress);
  check("سفارش با آدرس معتبر ثبت شد", r.ok === true, r.error ?? r.orderNumber);

  if (r.ok) {
    const { rows } = await db.query(
      'SELECT "province","city","address","postalCode" FROM "Order" WHERE "orderNumber" = $1',
      [r.orderNumber]
    );
    const o = rows[0];
    check(
      "آدرس روی سفارش ذخیره شد",
      o?.province === "تهران" && o?.city === "ورامین" && o?.postalCode === "3371956241",
      `${o?.province}، ${o?.city} — ${o?.postalCode}`
    );

    const { rows: users } = await db.query(
      `SELECT u."province", u."city", u."postalCode" FROM "User" u
        JOIN "Order" o ON o."userId" = u.id WHERE o."orderNumber" = $1`,
      [r.orderNumber]
    );
    check(
      "آدرس روی پروفایل هم ذخیره شد (خرید بعدی خودکار پر می‌شود)",
      users[0]?.province === "تهران" && users[0]?.postalCode === "3371956241",
      `${users[0]?.province}، ${users[0]?.city}`
    );
  }
}

await db.end();
const passed = results.filter((r) => r.passed).length;
console.log(`\n${passed} از ${results.length} تست موفق\n`);
process.exit(passed === results.length ? 0 : 1);
