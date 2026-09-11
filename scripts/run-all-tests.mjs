/**
 * اجرای همه‌ی تست‌های خودکار پروژه.
 * قبل از اجرا مطمئن شوید سایت با `npm run dev` بالا است.
 *
 * اجرا:  npm test
 */
import { execFileSync } from "node:child_process";

const suites = [
  ["test-otp", "درخواست کد تایید و محافظت ضدبات"],
  ["test-login", "ورود و ساخت سشن"],
  ["test-account", "پنل کاربری"],
  ["test-address", "آدرس پستی"],
  ["test-payment", "پرداخت و تلاش‌های تقلب"],
  ["test-admin", "دسترسی و سفارش‌های پنل ادمین"],
  ["test-admin-products", "مدیریت محصولات"],
  ["test-pricing", "قیمت‌گذاری دلاری"],
  ["test-discount", "کد تخفیف"],
  ["test-reviews", "نظرات محصول"],
];

let failed = 0;

for (const [file, label] of suites) {
  process.stdout.write(`\n▸ ${label}\n`);
  try {
    execFileSync("node", [`scripts/${file}.mjs`], { stdio: "inherit" });
  } catch {
    failed++;
  }
}

console.log(
  failed === 0
    ? "\n════════ همه‌ی تست‌ها موفق بودند ════════\n"
    : `\n════════ ${failed} گروه تست شکست خورد ════════\n`
);
process.exit(failed === 0 ? 0 : 1);
