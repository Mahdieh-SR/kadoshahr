/**
 * تست پنل کاربری: ورود واقعی، دسترسی به صفحات پنل، و محافظت از آن‌ها.
 * اجرا: node scripts/test-account.mjs
 */
import "dotenv/config";
import { Client } from "pg";

const BASE = "http://localhost:3000";
const results = [];

function check(name, passed, detail = "") {
  results.push({ passed });
  console.log(`${passed ? "✔" : "✘"} ${name}${detail ? ` — ${detail}` : ""}`);
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
    has: (n) => [...jar.keys()].some((k) => k.includes(n)),
  };
}

{
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query('DELETE FROM "RateLimit"');
  await db.end();
}

// ── بدون ورود، پنل باید به صفحه ورود بفرستد ──
{
  const res = await fetch(`${BASE}/account`, { redirect: "manual" });
  const location = res.headers.get("location") ?? "";
  check(
    "بدون ورود، /account به صفحه ورود هدایت می‌شود",
    (res.status === 307 || res.status === 302) && location.includes("/login"),
    `→ ${location}`
  );
}

// ── ورود ──
const phone = "0912" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
const jar = makeJar();

{
  const otp = await (
    await fetch(`${BASE}/api/auth/otp/request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    })
  ).json();

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
      csrfToken,
      phone,
      code: otp.devCode,
      callbackUrl: BASE,
      json: "true",
    }),
  });
  jar.absorb(res);
  check("ورود انجام شد", jar.has("session-token"));
}

// ── صفحات پنل باید باز شوند (نه ۴۰۴، نه ریدایرکت) ──
for (const [path, label] of [
  ["/account", "پیشخوان"],
  ["/account/orders", "سفارش‌های من"],
  ["/account/profile", "اطلاعات حساب"],
]) {
  const res = await fetch(BASE + path, {
    headers: { cookie: jar.header() },
    redirect: "manual",
  });
  const body = res.status === 200 ? await res.text() : "";
  check(
    `صفحه‌ی «${label}» باز می‌شود`,
    res.status === 200 && body.includes("حساب کاربری"),
    `کد پاسخ: ${res.status}`
  );
}

// ── شماره کاربر باید در پنل دیده شود ──
{
  const res = await fetch(`${BASE}/account`, { headers: { cookie: jar.header() } });
  const body = await res.text();
  check("شماره‌ی کاربر در پنل نمایش داده می‌شود", body.includes(phone), phone);
}

const passed = results.filter((r) => r.passed).length;
console.log(`\n${passed} از ${results.length} تست موفق\n`);
process.exit(passed === results.length ? 0 : 1);
