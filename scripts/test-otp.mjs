/**
 * تست خودکار مسیر OTP: درخواست کد، محافظت ضدبات، و سقف تعداد درخواست.
 * اجرا:  node scripts/test-otp.mjs
 */
import "dotenv/config";
import { Client } from "pg";

const BASE = "http://localhost:3000";
const results = [];

// شمارنده‌های محدودیت نرخ از اجرای قبلی پاک می‌شوند، وگرنه تست دوم
// همیشه با پیام «تعداد درخواست بیش از حد» شکست می‌خورد.
{
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const { rowCount } = await db.query('DELETE FROM "RateLimit"');
  await db.end();
  console.log(`(${rowCount} شمارنده‌ی محدودیت نرخ پاک شد)\n`);
}

function check(name, passed, detail = "") {
  results.push({ name, passed, detail });
  console.log(`${passed ? "✔" : "✘"} ${name}${detail ? ` — ${detail}` : ""}`);
}

async function post(path, body) {
  const res = await fetch(BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}

// شماره‌ی تصادفی تا هر بار اجرا، سقف‌های قبلی دخالت نکنند
const rand = () => "09" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0");

// ۱) شماره نامعتبر باید رد شود
{
  const { status, data } = await post("/api/auth/otp/request", { phone: "12345" });
  check("شماره نامعتبر رد می‌شود", status === 400 && !data.ok, data.error);
}

// ۲) شماره معتبر باید کد بگیرد
let phone = rand();
{
  const { status, data } = await post("/api/auth/otp/request", { phone });
  check(
    "درخواست کد با شماره معتبر موفق است",
    status === 200 && data.ok && /^\d{6}$/.test(data.devCode ?? ""),
    `کد: ${data.devCode}`
  );
}

// ۳) ارسال مجدد بلافاصله باید بلاک شود
{
  const { status, data } = await post("/api/auth/otp/request", { phone });
  check("ارسال مجدد فوری بلاک می‌شود", status === 429 && !data.ok, data.error);
}

// ۴) تله‌ی ضدبات: پاسخ موفق ولی بدون کد
{
  const { status, data } = await post("/api/auth/otp/request", {
    phone: rand(),
    website: "http://spam.example",
  });
  check(
    "فیلد تله‌ی بات کد صادر نمی‌کند",
    status === 200 && data.ok && !data.devCode,
    "بات پاسخ موفق می‌گیرد ولی پیامکی ارسال نمی‌شود"
  );
}

// ۵) ارقام فارسی باید پذیرفته شوند
{
  const faPhone = "۰۹۳۵" + String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const { status, data } = await post("/api/auth/otp/request", { phone: faPhone });
  check(
    "شماره با ارقام فارسی پذیرفته می‌شود",
    status === 200 && data.ok,
    `تبدیل شد به: ${data.phone}`
  );
}

// ۶) سقف تعداد درخواست روی یک شماره (۵ بار در ساعت)
{
  let blockedAt = null;
  for (let i = 1; i <= 8; i++) {
    const p = rand();
    // برای عبور از فاصله‌ی ارسال مجدد، هر بار شماره‌ی جدید ولی همان IP
    const { status } = await post("/api/auth/otp/request", { phone: p });
    if (status === 429) {
      blockedAt = i;
      break;
    }
  }
  check(
    "سقف درخواست بر اساس IP فعال است",
    blockedAt !== null,
    blockedAt ? `از درخواست ${blockedAt}ام بلاک شد` : "بلاک نشد!"
  );
}

console.log(
  `\n${results.filter((r) => r.passed).length} از ${results.length} تست موفق\n`
);
process.exit(results.every((r) => r.passed) ? 0 : 1);
