/**
 * تست کامل مسیر پرداخت — شامل تلاش‌های واقعی برای تقلب.
 *
 * سناریوها:
 *   ۱. خرید موفق: سفارش ساخته می‌شود، پرداخت تایید می‌شود، موجودی کم می‌شود
 *   ۲. خرید ناموفق: وضعیت FAILED ثبت می‌شود و موجودی دست‌نخورده می‌ماند
 *   ۳. تقلب: کاربر Status=NOK را در آدرس به OK تغییر می‌دهد
 *   ۴. تقلب: کاربر بدون پرداخت، مستقیم آدرس تایید را صدا می‌زند
 *   ۵. دسترسی: کاربر دیگری نتواند نتیجه‌ی سفارش را ببیند
 *
 * اجرا: node scripts/test-payment.mjs
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
    has: (n) => [...jar.keys()].some((k) => k.includes(n)),
  };
}

/** اتصال با تلاش مجدد — شبکه گاهی موقع DNS خطای گذرا می‌دهد */
async function connectWithRetry(attempts = 5) {
  for (let i = 0; i < attempts; i++) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      return client;
    } catch (e) {
      await client.end().catch(() => {});
      if (i === attempts - 1) throw e;
      await new Promise((r) => setTimeout(r, 800 * (i + 1)));
    }
  }
  throw new Error("unreachable");
}


/**
 * دقیقاً همان کاری که کلیک روی دکمه‌های صفحه‌ی درگاه انجام می‌دهد:
 * ارسال فرم HTML به آدرس درگاه، و بعد دنبال کردن ریدایرکت‌ها.
 * عمداً دیتابیس را مستقیم دستکاری نمی‌کنیم تا خود دکمه هم تست شود.
 */
async function pressGatewayButton(authority, decision) {
  const res = await fetch(`${BASE}/api/mock-gateway/decide`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ authority, decision }),
  });

  const next = res.headers.get("location");
  if (!next) return { gatewayRedirect: null, verifyRedirect: null };

  const verifyRes = await fetch(new URL(next, BASE), { redirect: "manual" });
  return {
    gatewayRedirect: next,
    verifyRedirect: verifyRes.headers.get("location"),
  };
}

const db = await connectWithRetry();
await db.query('DELETE FROM "RateLimit"');

/** ورود یک کاربر تازه و برگرداندن کوکی‌جار */
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
      csrfToken,
      phone,
      code: otp.devCode,
      callbackUrl: BASE,
      json: "true",
    }),
  });
  jar.absorb(res);
  return { jar, phone };
}

/** ساخت سفارش از طریق همان Server Action که فرم سایت صدا می‌زند */
async function createOrder(jar, variantId, quantity = 1) {
  // Server Action ها از طریق فرم فراخوانی می‌شوند؛ برای تست مستقیم،
  // سفارش را از مسیر واقعی می‌سازیم: صفحه‌ی تسویه را باز و اکشن را صدا می‌زنیم.
  // ساده‌تر: مستقیم از دیتابیس بعد از فراخوانی اکشن بررسی می‌کنیم.
  const res = await fetch(`${BASE}/api/test/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: jar.header() },
    body: JSON.stringify({
      firstName: "تست",
      lastName: "کاربر",
      email: "test@example.com",
      // آدرس از زمانی که ارسال پستی اضافه شد، اجباری است
      province: "تهران",
      city: "تهران",
      address: "خیابان آزادی، کوچه دوم، پلاک ۱۰، واحد ۴",
      postalCode: "1345678901",
      items: [{ variantId, quantity }],
    }),
  });
  return res.json();
}

// یک وردایانت با موجودی مشخص برمی‌داریم
const { rows: variants } = await db.query(
  `select v.id, v.price, v.stock, p.title
     from "ProductVariant" v join "Product" p on p.id = v."productId"
    where v.stock > 5 order by v.price asc limit 1`
);
const variant = variants[0];
console.log(
  `\nمحصول تست: ${variant.title}\nقیمت: ${fa.format(variant.price)} تومان | موجودی اولیه: ${variant.stock}\n`
);

// ─────────── ۱) خرید موفق ───────────
{
  const { jar } = await loginNewUser();
  const order = await createOrder(jar, variant.id, 2);

  const before = variant.stock;
  const gatewayUrl = order.paymentUrl;
  const authority = new URL(gatewayUrl, BASE).searchParams.get("authority");

  // 👆 کلیک واقعی روی دکمه‌ی «پرداخت موفق ✅» در صفحه‌ی درگاه
  const flow = await pressGatewayButton(authority, "approve");

  const { rows } = await db.query(
    'SELECT "status", "refId", "totalAmount" FROM "Order" WHERE "authority" = $1',
    [authority]
  );
  const { rows: stockRows } = await db.query(
    'SELECT "stock" FROM "ProductVariant" WHERE id = $1',
    [variant.id]
  );

  check(
    "پرداخت موفق: وضعیت سفارش PAID می‌شود",
    rows[0]?.status === "PAID",
    `وضعیت: ${rows[0]?.status} | شماره پیگیری: ${rows[0]?.refId}`
  );
  check(
    "پرداخت موفق: مبلغ از دیتابیس محاسبه شده",
    rows[0]?.totalAmount === variant.price * 2,
    `${fa.format(rows[0]?.totalAmount)} = ${fa.format(variant.price)} × ۲`
  );
  check(
    "پرداخت موفق: موجودی کم شد",
    stockRows[0].stock === before - 2,
    `${before} → ${stockRows[0].stock}`
  );
  check(
    "پرداخت موفق: کاربر به صفحه نتیجه هدایت شد",
    (flow.verifyRedirect ?? "").includes("/result"),
    `مسیر: درگاه → تایید → ${flow.verifyRedirect}`
  );
}

// ─────────── ۲) پرداخت ناموفق ───────────
{
  const { jar } = await loginNewUser();
  const order = await createOrder(jar, variant.id, 1);
  const authority = new URL(order.paymentUrl, BASE).searchParams.get("authority");

  const { rows: stockBefore } = await db.query(
    'SELECT "stock" FROM "ProductVariant" WHERE id = $1',
    [variant.id]
  );

  // 👆 کلیک واقعی روی دکمه‌ی «انصراف / پرداخت ناموفق ❌»
  await pressGatewayButton(authority, "reject");

  const { rows } = await db.query(
    'SELECT "status", "failureReason" FROM "Order" WHERE "authority" = $1',
    [authority]
  );
  const { rows: stockAfter } = await db.query(
    'SELECT "stock" FROM "ProductVariant" WHERE id = $1',
    [variant.id]
  );

  check(
    "پرداخت ناموفق: وضعیت FAILED ثبت شد",
    rows[0]?.status === "FAILED",
    `دلیل: ${rows[0]?.failureReason}`
  );
  check(
    "پرداخت ناموفق: موجودی دست‌نخورده ماند",
    stockAfter[0].stock === stockBefore[0].stock,
    `موجودی: ${stockAfter[0].stock}`
  );
}

// ─────────── ۳) تقلب: دستکاری Status در آدرس ───────────
{
  const { jar } = await loginNewUser();
  const order = await createOrder(jar, variant.id, 1);
  const authority = new URL(order.paymentUrl, BASE).searchParams.get("authority");

  // کاربر هیچ پولی نداده (approved همچنان null است)
  // ولی در نوار آدرس مرورگر می‌نویسد Status=OK
  await fetch(`${BASE}/api/payment/verify?Authority=${authority}&Status=OK`, {
    redirect: "manual",
  });

  const { rows } = await db.query(
    'SELECT "status", "failureReason" FROM "Order" WHERE "authority" = $1',
    [authority]
  );

  check(
    "🔒 تقلب: Status=OK جعلی پذیرفته نشد",
    rows[0]?.status === "FAILED",
    `کاربر بدون پرداخت Status=OK فرستاد → وضعیت: ${rows[0]?.status}`
  );
}

// ─────────── ۴) تقلب: صدا زدن آدرس تایید با Authority الکی ───────────
{
  const res = await fetch(
    `${BASE}/api/payment/verify?Authority=MOCKFAKE0000000000000000000000&Status=OK`,
    { redirect: "manual" }
  );
  check(
    "🔒 تقلب: Authority جعلی سفارشی نمی‌سازد",
    (res.headers.get("location") ?? "").includes("payment-error"),
    "به صفحه‌ی خطا هدایت شد"
  );
}

// ─────────── ۵) تقلب: دیدن سفارش کاربر دیگر ───────────
{
  const { jar: buyerJar } = await loginNewUser();
  const order = await createOrder(buyerJar, variant.id, 1);
  const authority = new URL(order.paymentUrl, BASE).searchParams.get("authority");
  const { rows } = await db.query(
    'SELECT id FROM "Order" WHERE "authority" = $1',
    [authority]
  );
  const orderId = rows[0].id;

  const { jar: strangerJar } = await loginNewUser();
  const res = await fetch(`${BASE}/order/${orderId}/result`, {
    headers: { cookie: strangerJar.header() },
    redirect: "manual",
  });

  check(
    "🔒 دسترسی: کاربر دیگر نمی‌تواند سفارش را ببیند",
    res.status === 404,
    `کد پاسخ: ${res.status}`
  );
}

// ─────────── ۶) تایید دوباره‌ی سفارش پرداخت‌شده ───────────
{
  const { jar } = await loginNewUser();
  const order = await createOrder(jar, variant.id, 1);
  const authority = new URL(order.paymentUrl, BASE).searchParams.get("authority");

  await pressGatewayButton(authority, "approve");

  const { rows: stockAfterFirst } = await db.query(
    'SELECT "stock" FROM "ProductVariant" WHERE id = $1',
    [variant.id]
  );

  // کاربر صفحه را رفرش می‌کند → دوباره همان آدرس صدا زده می‌شود
  await fetch(`${BASE}/api/payment/verify?Authority=${authority}&Status=OK`, {
    redirect: "manual",
  });

  const { rows: stockAfterSecond } = await db.query(
    'SELECT "stock" FROM "ProductVariant" WHERE id = $1',
    [variant.id]
  );

  check(
    "🔒 رفرش صفحه‌ی بازگشت، موجودی را دوباره کم نمی‌کند",
    stockAfterFirst[0].stock === stockAfterSecond[0].stock,
    `موجودی ثابت ماند: ${stockAfterSecond[0].stock}`
  );
}

await db.end();

const passed = results.filter((r) => r.passed).length;
console.log(`\n${passed} از ${results.length} تست موفق\n`);
process.exit(passed === results.length ? 0 : 1);
