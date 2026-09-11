/**
 * تست سایت زنده — کل مسیر خرید از ورود تا صفحه‌ی نتیجه.
 *
 * اجرا:
 *   LIVE_URL=https://<آدرس سرویس> node scripts/test-live.mjs
 *
 * آدرس عمداً پیش‌فرض ندارد: یک بار با آدرس اشتباه تست گرفتن و «همه سبز»
 * دیدن، بدترین حالت ممکن است.
 */
const BASE = (process.env.LIVE_URL ?? "").replace(/\/+$/, "");

if (!BASE) {
  console.error(
    "متغیر LIVE_URL تنظیم نشده است.\n" +
      "  مثال: LIVE_URL=https://kadoshahr.ir node scripts/test-live.mjs"
  );
  process.exit(1);
}

/** برای بررسی اینکه لینک‌های داخل sitemap به همین دامنه اشاره می‌کنند */
const BASE_HOST = new URL(BASE).host;
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

/**
 * تستی که روی این محیط اصلاً اجراشدنی نیست — نه موفق، نه شکست‌خورده.
 *
 * روی سرور واقعی کد تایید عمداً به مرورگر برنمی‌گردد؛ این یک قاعده‌ی امنیتی
 * است نه نقص. قرمز نشان دادن چنین تستی باعث می‌شود آدم به شکست‌های واقعی هم
 * بی‌اعتنا شود.
 */
function skip(name, reason) {
  results.push({ passed: true, skipped: true });
  console.log(`⃝ ${name}\n     رد شد — ${reason}`);
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

/**
 * وقتی سایت در حالت production است و DEMO_MODE روشن نیست، کد تایید در پاسخ
 * نمی‌آید. این درست است — پس بقیه‌ی مسیر ورود رد می‌شود، نه شکست‌خورده.
 */
const canLogIn = Boolean(otp.devCode);

if (canLogIn) {
  check("کد تایید صادر و نمایش داده شد", true, `کد: ${otp.devCode}`);
} else {
  skip(
    "کد تایید صادر و نمایش داده شد",
    "سایت در حالت production است و کد تایید را برنمی‌گرداند (رفتار درست). " +
      "برای تست کامل مسیر خرید، موقتاً DEMO_MODE=true بگذار."
  );
}

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
  if (canLogIn) check("ورود موفق و سشن ساخته شد", jar.has("session-token"));
  else skip("ورود موفق و سشن ساخته شد", "بدون کد تایید ممکن نیست");
}

/* ── ۴) پنل کاربری بعد از ورود ── */
{
  const res = await fetch(`${BASE}/account`, {
    headers: { cookie: jar.header() },
    redirect: "manual",
  });
  if (canLogIn)
    check("پنل کاربری بعد از ورود باز می‌شود", res.status === 200, `کد ${res.status}`);
  else skip("پنل کاربری بعد از ورود باز می‌شود", "بدون ورود ممکن نیست");
}

/* ── ۵) سبد و قیمت‌گذاری ── */
let variantId = null;
{
  const html = await (await fetch(`${BASE}/products`)).text();
  const slug = html.match(/\/product\/([a-z0-9-]+)/)?.[1];

  const productHtml = await (await fetch(`${BASE}/product/${slug}`)).text();

  // شناسه‌ها ممکن است در HTML به شکل‌های مختلف کدگذاری شوند؛ همه‌ی
  // کاندیداها را جمع می‌کنیم و با API سبد بررسی می‌کنیم کدام واقعی است.
  //
  // ⚠️ دو شکل شناسه در دیتابیس وجود دارد و هر دو باید پوشش داده شوند:
  //   • cuid  — رکوردهایی که Prisma ساخته (`c` + ۲۴ کاراکتر)
  //   • UUID  — رکوردهایی که seed-catalog.mjs با gen_random_uuid() ساخته
  // قبلاً فقط cuid گرفته می‌شد و روی دیتابیس تازه‌ی رانفلر هیچ کاندیدایی
  // پیدا نمی‌کرد، در حالی که خود سایت سالم بود.
  const candidates = [
    ...new Set([
      ...(productHtml.match(/c[a-z0-9]{24,39}/g) ?? []),
      ...(productHtml.match(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g
      ) ?? []),
    ]),
  ];

  for (const candidate of candidates.slice(0, 25)) {
    const res = await fetch(`${BASE}/api/cart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variantIds: [candidate] }),
    });
    const data = await res.json();
    if (data.items?.length) {
      variantId = candidate;
      break;
    }
  }

  check(
    "شناسه‌ی محصول از صفحه خوانده شد",
    Boolean(variantId),
    `محصول: ${slug}`
  );
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
// اعمال کد تخفیف نیاز به ورود دارد، پس بدون کد تایید اجراشدنی نیست.
if (variantId && !canLogIn) {
  skip("کد تخفیف WELCOME20 کار می‌کند", "اعمال کد تخفیف نیاز به ورود دارد");
} else if (variantId) {
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
    res.status === 200 && body.includes(BASE_HOST),
    `لینک‌های sitemap باید به ${BASE_HOST} اشاره کنند`
  );
}

const skipped = results.filter((r) => r.skipped).length;
const ran = results.filter((r) => !r.skipped);
const passed = ran.filter((r) => r.passed).length;

console.log(
  `\n${passed} از ${ran.length} تست موفق` +
    (skipped ? `  ·  ${skipped} تست رد شد (نیازمند DEMO_MODE)` : "") +
    "\n"
);
process.exit(passed === ran.length ? 0 : 1);
