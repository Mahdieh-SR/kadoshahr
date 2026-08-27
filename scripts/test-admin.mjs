/**
 * تست پنل ادمین — شامل تلاش کاربر عادی برای دسترسی و تغییر داده.
 * اجرا: node scripts/test-admin.mjs
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

/** ورود با یک شماره‌ی مشخص (اگر کاربر نبود ساخته می‌شود) */
async function loginAs(phone) {
  // فاصله‌ی اجباری ۶۰ ثانیه بین دو کد، برای کاربر واقعی درست است ولی وقتی
  // چند اسکریپت تست پشت سر هم اجرا می‌شوند مانع ورود می‌شود.
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
      csrfToken,
      phone,
      code: otp.devCode,
      callbackUrl: BASE,
      json: "true",
    }),
  });
  jar.absorb(res);
  return jar;
}

const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE ?? "09120000000";
await db.query(`UPDATE "User" SET role = 'ADMIN' WHERE phone = $1`, [ADMIN_PHONE]);

const randomPhone = () =>
  "0913" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0");

/* ─────────── ۱) بدون ورود ─────────── */
{
  const res = await fetch(`${BASE}/admin`, { redirect: "manual" });
  const loc = res.headers.get("location") ?? "";
  check(
    "🔒 بدون ورود، /admin به صفحه ورود می‌رود",
    res.status === 307 && loc.includes("/login"),
    `→ ${loc}`
  );
}

/* ─────────── ۲) کاربر عادی ─────────── */
const userJar = await loginAs(randomPhone());
{
  const res = await fetch(`${BASE}/admin`, {
    headers: { cookie: userJar.header() },
    redirect: "manual",
  });
  const loc = res.headers.get("location") ?? "";
  check(
    "🔒 کاربر عادی به /admin راه ندارد",
    res.status === 307 && loc.includes("/account"),
    `→ ${loc}`
  );
}
{
  const res = await fetch(`${BASE}/admin/orders`, {
    headers: { cookie: userJar.header() },
    redirect: "manual",
  });
  check(
    "🔒 کاربر عادی به /admin/orders راه ندارد",
    res.status === 307,
    `کد پاسخ: ${res.status}`
  );
}

/* ─────────── ۳) ادمین ─────────── */
const adminJar = await loginAs(ADMIN_PHONE);

for (const [path, label] of [
  ["/admin", "پیشخوان"],
  ["/admin/orders", "فهرست سفارش‌ها"],
  ["/admin/products", "فهرست محصولات"],
  ["/admin/products/new", "محصول جدید"],
]) {
  const res = await fetch(BASE + path, {
    headers: { cookie: adminJar.header() },
    redirect: "manual",
  });
  check(`ادمین: صفحه‌ی «${label}» باز می‌شود`, res.status === 200, `کد: ${res.status}`);
}

/* ─────────── ۴) لیست ادمین با دیتابیس یکی است ─────────── */
{
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM "Order"');
  const res = await fetch(`${BASE}/admin/orders`, {
    headers: { cookie: adminJar.header() },
  });
  const body = await res.text();

  const { rows: sample } = await db.query(
    'SELECT "orderNumber" FROM "Order" ORDER BY "createdAt" DESC LIMIT 1'
  );
  check(
    "فهرست ادمین مستقیم از دیتابیس می‌آید",
    sample.length === 0 || body.includes(sample[0].orderNumber),
    `${rows[0].n} سفارش در دیتابیس؛ آخرین: ${sample[0]?.orderNumber ?? "—"}`
  );
}

/* ─────────── ۵) تغییر وضعیت سفارش ─────────── */
{
  const { rows } = await db.query(
    `SELECT id, status FROM "Order" WHERE status = 'PAID' ORDER BY "createdAt" DESC LIMIT 1`
  );

  if (rows.length === 0) {
    check("تغییر وضعیت سفارش", false, "سفارش پرداخت‌شده‌ای برای تست پیدا نشد");
  } else {
    const orderId = rows[0].id;

    // ابتدا کاربر عادی تلاش می‌کند
    const asUser = await fetch(`${BASE}/api/test/admin-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: userJar.header() },
      body: JSON.stringify({ orderId, status: "DELIVERED", deliveryNote: "نفوذ" }),
    }).then((r) => r.json());

    check(
      "🔒 کاربر عادی نمی‌تواند وضعیت سفارش را عوض کند",
      asUser.ok === false,
      asUser.error
    );

    const { rows: unchanged } = await db.query(
      'SELECT status FROM "Order" WHERE id = $1',
      [orderId]
    );
    check(
      "🔒 وضعیت سفارش بعد از تلاش کاربر عادی دست‌نخورده ماند",
      unchanged[0].status === "PAID",
      `وضعیت: ${unchanged[0].status}`
    );

    // حالا ادمین
    const asAdmin = await fetch(`${BASE}/api/test/admin-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: adminJar.header() },
      body: JSON.stringify({
        orderId,
        status: "DELIVERED",
        deliveryNote: "کد گیفت‌کارت: TEST-1234-5678",
      }),
    }).then((r) => r.json());

    check("ادمین وضعیت را به «تحویل‌شده» تغییر داد", asAdmin.ok === true, asAdmin.error);

    const { rows: after } = await db.query(
      'SELECT status, "deliveryNote" FROM "Order" WHERE id = $1',
      [orderId]
    );
    check(
      "تغییر در دیتابیس ثبت شد",
      after[0].status === "DELIVERED" && after[0].deliveryNote?.includes("TEST-1234"),
      `${after[0].status} — «${after[0].deliveryNote}»`
    );
  }
}

/* ─────────── ۶) وضعیت نامعتبر ─────────── */
{
  const { rows } = await db.query('SELECT id FROM "Order" LIMIT 1');
  if (rows.length > 0) {
    const res = await fetch(`${BASE}/api/test/admin-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: adminJar.header() },
      body: JSON.stringify({ orderId: rows[0].id, status: "HACKED" }),
    }).then((r) => r.json());
    check("🔒 وضعیت نامعتبر رد می‌شود", res.ok === false, res.error);
  }
}

await db.end();
const passed = results.filter((r) => r.passed).length;
console.log(`\n${passed} از ${results.length} تست موفق\n`);
process.exit(passed === results.length ? 0 : 1);
