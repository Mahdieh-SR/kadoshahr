/**
 * تست کامل ورود: درخواست کد → تایید کد → ساخته شدن سشن → دسترسی به پنل کاربری.
 * همچنین بررسی می‌کند که کد اشتباه پذیرفته نشود.
 *
 * اجرا: node scripts/test-login.mjs
 */
import "dotenv/config";
import { Client } from "pg";

const BASE = "http://localhost:3000";
const results = [];

function check(name, passed, detail = "") {
  results.push({ passed });
  console.log(`${passed ? "✔" : "✘"} ${name}${detail ? ` — ${detail}` : ""}`);
}

/** یک کوکی‌جار خیلی ساده تا بتوانیم مثل مرورگر رفتار کنیم */
function makeJar() {
  const jar = new Map();
  return {
    header: () =>
      [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; "),
    absorb(res) {
      for (const raw of res.headers.getSetCookie?.() ?? []) {
        const [pair] = raw.split(";");
        const idx = pair.indexOf("=");
        if (idx > 0) jar.set(pair.slice(0, idx), pair.slice(idx + 1));
      }
    },
    has: (name) => [...jar.keys()].some((k) => k.includes(name)),
  };
}

async function signIn(jar, phone, code) {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, {
    headers: { cookie: jar.header() },
  });
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
      csrfToken,
      phone,
      code,
      callbackUrl: BASE,
      json: "true",
    }),
  });
  jar.absorb(res);
  return res;
}

// پاک کردن شمارنده‌های محدودیت نرخ از اجراهای قبلی
{
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query('DELETE FROM "RateLimit"');
  await db.end();
}

const phone = "0912" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0");

// ۱) دریافت کد
const otpRes = await fetch(`${BASE}/api/auth/otp/request`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ phone }),
});
const otp = await otpRes.json();
check("کد تایید صادر شد", Boolean(otp.devCode), `کد: ${otp.devCode}`);

// ۲) کد اشتباه نباید کار کند
{
  const jar = makeJar();
  const wrong = otp.devCode === "000000" ? "111111" : "000000";
  await signIn(jar, phone, wrong);
  check("کد اشتباه سشن نمی‌سازد", !jar.has("session-token"));
}

// ۳) کد درست باید وارد کند
const jar = makeJar();
{
  await signIn(jar, phone, otp.devCode);
  check("کد درست سشن می‌سازد", jar.has("session-token"));
}

// ۴) سشن باید اطلاعات کاربر را برگرداند
{
  const res = await fetch(`${BASE}/api/auth/session`, {
    headers: { cookie: jar.header() },
  });
  const session = await res.json();
  check(
    "سشن اطلاعات کاربر را برمی‌گرداند",
    session?.user?.phone === phone && session?.user?.role === "USER",
    `شماره: ${session?.user?.phone} | نقش: ${session?.user?.role}`
  );
}

// ۵) همان کد نباید دوباره قابل استفاده باشد (کد یک‌بارمصرف است)
{
  const jar2 = makeJar();
  await signIn(jar2, phone, otp.devCode);
  check("کد مصرف‌شده دوباره کار نمی‌کند", !jar2.has("session-token"));
}

// ۶) کاربر عادی نباید به پنل ادمین دسترسی داشته باشد
{
  const res = await fetch(`${BASE}/admin`, {
    headers: { cookie: jar.header() },
    redirect: "manual",
  });
  check(
    "کاربر عادی به /admin راه ندارد",
    res.status === 307 || res.status === 302 || res.status === 404,
    `کد پاسخ: ${res.status}`
  );
}

const passed = results.filter((r) => r.passed).length;
console.log(`\n${passed} از ${results.length} تست موفق\n`);
process.exit(passed === results.length ? 0 : 1);
