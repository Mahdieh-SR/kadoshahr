/**
 * تست مدیریت محصولات در پنل ادمین:
 * ساخت، ویرایش، افزودن/حذف نسخه، نمایش در فروشگاه، و حذف امن.
 *
 * اجرا: node scripts/test-admin-products.mjs
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

async function save(jar, payload) {
  return fetch(`${BASE}/api/test/admin-product`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: jar.header() },
    body: JSON.stringify(payload),
  }).then((r) => r.json());
}

const { rows: cats } = await db.query('SELECT id, name FROM "Category" LIMIT 1');
const categoryId = cats[0].id;
const slug = `test-product-${Date.now()}`;

const baseProduct = {
  title: "محصول تستی خودکار",
  slug,
  description: "این محصول توسط اسکریپت تست ساخته شده است و بعداً حذف می‌شود.",
  categoryId,
  images: ["/products/steam-wallet-1.svg"],
  isActive: true,
  isFeatured: false,
  specs: [{ key: "زمان تحویل", value: "آنی" }],
  variants: [
    {
      label: "Steam — آمریکا — ۱۰ دلاری",
      platform: "Steam",
      region: "آمریکا",
      capacity: "۱۰ دلاری",
      price: 850000,
      compareAtPrice: null,
      stock: 5,
      isActive: true,
    },
  ],
};

/* ─── ۱) کاربر عادی نباید بتواند محصول بسازد ─── */
{
  const r = await save(userJar, baseProduct);
  check("🔒 کاربر عادی نمی‌تواند محصول بسازد", r.ok === false, r.error);
}

/* ─── ۲) ورودی نامعتبر ─── */
{
  const r = await save(adminJar, { ...baseProduct, slug: "سلام فارسی" });
  check("🔒 نشانی (slug) فارسی رد می‌شود", r.ok === false, r.error);
}
{
  const r = await save(adminJar, {
    ...baseProduct,
    slug: `${slug}-x`,
    variants: [{ ...baseProduct.variants[0], price: 10 }],
  });
  check("🔒 قیمت غیرمنطقی رد می‌شود", r.ok === false, r.error);
}
{
  const r = await save(adminJar, {
    ...baseProduct,
    slug: `${slug}-y`,
    categoryId: "cat-does-not-exist",
  });
  check("🔒 دسته‌بندی ناموجود رد می‌شود", r.ok === false, r.error);
}

/* ─── ۳) ادمین محصول می‌سازد ─── */
let productId;
{
  const r = await save(adminJar, baseProduct);
  productId = r.id;
  check("ادمین محصول ساخت", r.ok === true, r.error ?? `شناسه: ${r.id}`);
}

/* ─── ۴) محصول در فروشگاه دیده می‌شود ─── */
{
  const res = await fetch(`${BASE}/product/${slug}`);
  const body = await res.text();
  check(
    "محصول جدید در فروشگاه باز می‌شود",
    res.status === 200 && body.includes("محصول تستی خودکار"),
    `کد: ${res.status}`
  );
}

/* ─── ۵) slug تکراری ─── */
{
  const r = await save(adminJar, { ...baseProduct, slug });
  check("🔒 نشانی تکراری رد می‌شود", r.ok === false, r.error);
}

/* ─── ۶) ویرایش: افزودن نسخه‌ی دوم و تغییر قیمت ─── */
{
  const { rows: vs } = await db.query(
    'SELECT id FROM "ProductVariant" WHERE "productId" = $1',
    [productId]
  );

  const r = await save(adminJar, {
    ...baseProduct,
    id: productId,
    title: "محصول تستی ویرایش‌شده",
    variants: [
      {
        id: vs[0].id,
        label: "Steam — آمریکا — ۱۰ دلاری",
        platform: "Steam",
        region: "آمریکا",
        capacity: "۱۰ دلاری",
        price: 900000,
        compareAtPrice: 1000000,
        stock: 8,
        isActive: true,
      },
      {
        label: "Steam — ترکیه — ۲۰ دلاری",
        platform: "Steam",
        region: "ترکیه",
        capacity: "۲۰ دلاری",
        price: 1500000,
        compareAtPrice: null,
        stock: 3,
        isActive: true,
      },
    ],
  });

  check("ادمین محصول را ویرایش کرد", r.ok === true, r.error);

  const { rows: after } = await db.query(
    `SELECT p.title, v.price, v.stock, v.region
       FROM "Product" p JOIN "ProductVariant" v ON v."productId" = p.id
      WHERE p.id = $1 ORDER BY v.price ASC`,
    [productId]
  );

  check(
    "عنوان و قیمت به‌روز شد",
    after[0]?.title === "محصول تستی ویرایش‌شده" && after[0]?.price === 900000,
    `${after[0]?.title} — ${after[0]?.price}`
  );
  check(
    "نسخه‌ی دوم اضافه شد",
    after.length === 2 && after.some((v) => v.region === "ترکیه"),
    `${after.length} نسخه: ${after.map((v) => v.region).join("، ")}`
  );
}

/* ─── ۷) حذف نسخه با برداشتنش از لیست ─── */
{
  const { rows: vs } = await db.query(
    'SELECT id, region FROM "ProductVariant" WHERE "productId" = $1 ORDER BY price ASC',
    [productId]
  );

  const r = await save(adminJar, {
    ...baseProduct,
    id: productId,
    title: "محصول تستی ویرایش‌شده",
    variants: [
      {
        id: vs[0].id,
        label: "Steam — آمریکا — ۱۰ دلاری",
        platform: "Steam",
        region: "آمریکا",
        capacity: "۱۰ دلاری",
        price: 900000,
        compareAtPrice: null,
        stock: 8,
        isActive: true,
      },
    ],
  });

  const { rows: after } = await db.query(
    'SELECT COUNT(*)::int AS n FROM "ProductVariant" WHERE "productId" = $1',
    [productId]
  );
  check("حذف نسخه از لیست کار می‌کند", r.ok === true && after[0].n === 1, `${after[0].n} نسخه ماند`);
}

/* ─── ۸) کاربر عادی نمی‌تواند حذف کند ─── */
{
  const r = await fetch(`${BASE}/api/test/admin-product`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: userJar.header() },
    body: JSON.stringify({ __action: "delete", id: productId }),
  }).then((r) => r.json());
  check("🔒 کاربر عادی نمی‌تواند محصول حذف کند", r.ok === false, r.error);
}

/* ─── ۹) ادمین حذف می‌کند ─── */
{
  const r = await fetch(`${BASE}/api/test/admin-product`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: adminJar.header() },
    body: JSON.stringify({ __action: "delete", id: productId }),
  }).then((r) => r.json());

  const { rows } = await db.query(
    'SELECT COUNT(*)::int AS n FROM "Product" WHERE id = $1',
    [productId]
  );
  check("ادمین محصول تستی را حذف کرد", r.ok === true && rows[0].n === 0, r.message);
}

/* ─── ۱۰) محصولی که در سفارش استفاده شده حذف نمی‌شود، غیرفعال می‌شود ─── */
{
  const { rows } = await db.query(
    `SELECT DISTINCT p.id, p.title FROM "Product" p
       JOIN "ProductVariant" v ON v."productId" = p.id
       JOIN "OrderItem" oi ON oi."variantId" = v.id
      LIMIT 1`
  );

  if (rows.length === 0) {
    check("محافظت از محصول دارای سفارش", false, "محصولی با سفارش پیدا نشد");
  } else {
    const r = await fetch(`${BASE}/api/test/admin-product`, {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: adminJar.header() },
      body: JSON.stringify({ __action: "delete", id: rows[0].id }),
    }).then((r) => r.json());

    const { rows: after } = await db.query(
      'SELECT "isActive" FROM "Product" WHERE id = $1',
      [rows[0].id]
    );

    check(
      "🔒 محصول دارای سفارش حذف نشد، فقط غیرفعال شد",
      after.length === 1 && after[0].isActive === false,
      `«${rows[0].title}» — سابقه‌ی سفارش‌ها سالم ماند`
    );

    // برگرداندن به حالت فعال تا فروشگاه دست‌نخورده بماند
    await db.query('UPDATE "Product" SET "isActive" = true WHERE id = $1', [rows[0].id]);
  }
}

/* ─── کادرهای انتخاب صفحه‌ی محصول ─── */
{
  const optionSlug = `test-options-${Date.now()}`;
  const r = await save(adminJar, {
    ...baseProduct,
    slug: optionSlug,
    // ترتیب عمداً غیرالفبایی است تا ثابت شود همین ترتیب ذخیره می‌شود
    optionLabels: [
      { axis: "capacity", label: "مدت زمان اشتراک" },
      { axis: "platform", label: "پلن اکانت" },
      // محور تکراری باید حذف شود
      { axis: "capacity", label: "تکراری" },
    ],
  });

  check("محصول با کادرهای انتخاب دلخواه ساخته شد", r.ok === true, r.message ?? r.error);

  const { rows } = await db.query('SELECT "optionLabels" FROM "Product" WHERE slug = $1', [
    optionSlug,
  ]);
  const labels = rows[0]?.optionLabels;

  check(
    "ترتیب کادرها همان‌طور که وارد شد ذخیره شد",
    Array.isArray(labels) &&
      labels.length === 2 &&
      labels[0].axis === "capacity" &&
      labels[1].axis === "platform",
    JSON.stringify(labels)
  );

  check(
    "محور تکراری کنار گذاشته شد",
    Array.isArray(labels) && labels.filter((l) => l.axis === "capacity").length === 1,
    `${Array.isArray(labels) ? labels.length : 0} کادر ذخیره شد`
  );

  // عنوان بیش از حد بلند باید رد شود
  const tooLong = await save(adminJar, {
    ...baseProduct,
    slug: `${optionSlug}-x`,
    optionLabels: [{ axis: "capacity", label: "ط".repeat(41) }],
  });
  check("🔒 عنوان کادر بیش از ۴۰ کاراکتر رد می‌شود", tooLong.ok === false, tooLong.error);

  if (r.id) await save(adminJar, { __action: "delete", id: r.id });
}

await db.end();
const passed = results.filter((r) => r.passed).length;
console.log(`\n${passed} از ${results.length} تست موفق\n`);
process.exit(passed === results.length ? 0 : 1);
