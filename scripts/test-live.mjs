/**
 * تست سایت زنده روی لیارا — کل مسیر خرید از ورود تا صفحه‌ی نتیجه.
 *
 * اجرا: node scripts/test-live.mjs
 * (آدرس را با متغیر LIVE_URL می‌توان عوض کرد)
 */
const BASE = process.env.LIVE_URL ?? "https://giftland.liara.run";
const results = [];

/**
 * fetch با تلاش مجدد — اتصال به سرور ایران گاهی وسط کار قطع می‌شود
 * و این ربطی به سالم بودن سایت ندارد.
 */
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  let lastError;
  for (let i = 0; i < 4; i++) {
    try {
      return await realFetch(url, opts);
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastError;
};


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

const randomPhone = () =>
  "0912" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0");

/* ── ۱) صفحات عمومی ── */
for (const [path, label] of [
  ["/", "صفحه اصلی"],
  ["/products", "فهرست محصولات"],
  ["/cart", "سبد خرید"],
  ["/login", "ورود"],
  ["/checkout", "تسویه‌حساب"],
]) {
  const res = await fetch(BASE + path);
  check(`${label} باز می‌شود`, res.status === 200, `کد ${res.status}`);
}

/* ── ۲) محافظت از پنل‌ها ── */
for (const [path, label] of [
  ["/admin", "پنل مدیریت"],
  ["/account", "پنل کاربری"],
]) {
  const res = await fetch(BASE + path, { redirect: "manual" });
  check(
    `🔒 ${label} بدون ورود قفل است`,
    res.status === 307 || res.status === 302,
    `کد ${res.status}`
  );
}

/* ── ۳) ورود ── */
const phone = randomPhone();
const jar = makeJar();

const otp = await (
  await fetch(`${BASE}/api/auth/otp/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  })
).json();

check("کد تایید صادر و نمایش داده شد", Boolean(otp.devCode), `کد: ${otp.devCode}`);

{
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
  check("ورود موفق و سشن ساخته شد", jar.has("session-token"));
}

/* ── ۴) پنل کاربری بعد از ورود ── */
{
  const res = await fetch(`${BASE}/account`, {
    headers: { cookie: jar.header() },
    redirect: "manual",
  });
  check("پنل کاربری بعد از ورود باز می‌شود", res.status === 200, `کد ${res.status}`);
}

/* ── ۵) سبد و قیمت‌گذاری ── */
let variantId = null;
{
  const html = await (await fetch(`${BASE}/products`)).text();
  const slug = html.match(/\/product\/([a-z0-9-]+)/)?.[1];

  const productHtml = await (await fetch(`${BASE}/product/${slug}`)).text();
  variantId = productHtml.match(/"(c[a-z0-9]{20,})"/)?.[1] ?? null;

  check("شناسه‌ی محصول از صفحه خوانده شد", Boolean(variantId), `محصول: ${slug}`);
}

if (variantId) {
  const res = await fetch(`${BASE}/api/cart`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ variantIds: [variantId] }),
  });
  const data = await res.json();
  const item = data.items?.[0];
  check(
    "قیمت از دیتابیس خوانده می‌شود",
    Boolean(item?.price),
    item ? `${item.title} — ${item.price.toLocaleString("fa-IR")} تومان` : "—"
  );
}

/* ── ۶) کد تخفیف ── */
if (variantId) {
  const res = await fetch(`${BASE}/api/discount`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: jar.header() },
    body: JSON.stringify({
      code: "WELCOME20",
      items: [{ variantId, quantity: 1 }],
    }),
  });
  const data = await res.json();
  check(
    "کد تخفیف WELCOME20 کار می‌کند",
    data.ok === true,
    data.ok
      ? `${data.label} — ${data.amount.toLocaleString("fa-IR")} تومان`
      : data.error
  );
}

/* ── ۷) امنیت: تلاش برای جعل نتیجه‌ی پرداخت ── */
{
  const res = await fetch(
    `${BASE}/api/payment/verify?Authority=MOCKFAKE000000000000000000&Status=OK`,
    { redirect: "manual" }
  );
  const loc = res.headers.get("location") ?? "";
  check(
    "🔒 تراکنش جعلی پذیرفته نمی‌شود",
    loc.includes("payment-error"),
    "به صفحه‌ی خطا هدایت شد"
  );
}

/* ── ۸) هدرهای امنیتی و SEO ── */
{
  const res = await fetch(BASE);
  const h = res.headers;
  check(
    "هدرهای امنیتی فعال‌اند",
    h.get("x-frame-options") === "DENY" &&
      h.get("x-content-type-options") === "nosniff"
  );
}
{
  const res = await fetch(`${BASE}/sitemap.xml`);
  const body = await res.text();
  check(
    "نقشه‌ی سایت ساخته می‌شود",
    res.status === 200 && body.includes("giftland.liara.run")
  );
}

const passed = results.filter((r) => r.passed).length;
console.log(`\n${passed} از ${results.length} تست موفق\n`);
process.exit(passed === results.length ? 0 : 1);
