/**
 * تکمیل خروجی standalone بعد از `next build`.
 *
 * `output: "standalone"` یک سرور کامل در `.next/standalone` می‌سازد، ولی
 * عمداً دو چیز را داخلش کپی نمی‌کند چون فرض می‌کند یک CDN آن‌ها را سرو
 * می‌کند:
 *   • `public/`      → تصویر محصولات، فاوآیکون
 *   • `.next/static` → فایل‌های JS و CSS ساخته‌شده
 *
 * ما CDN نداریم و خود Node باید سرو‌شان کند، پس اینجا کپی می‌شوند. بدون این
 * قدم سایت بالا می‌آید ولی بدون استایل و بدون تصویر — و خطایی هم نمی‌دهد،
 * فقط ۴۰۴ می‌گیرد. برای همین جزو `npm run build` است، نه یک قدم دستی.
 */
import { cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.error(
    "پوشه‌ی .next/standalone پیدا نشد.\n" +
      "یعنی `next build` یا اجرا نشده، یا `output: \"standalone\"` از next.config برداشته شده."
  );
  process.exit(1);
}

const copies = [
  { from: join(root, "public"), to: join(standalone, "public"), name: "public" },
  {
    from: join(root, ".next", "static"),
    to: join(standalone, ".next", "static"),
    name: ".next/static",
  },
];

for (const { from, to, name } of copies) {
  if (!existsSync(from)) {
    console.error(`«${name}» پیدا نشد: ${from}`);
    process.exit(1);
  }
  cpSync(from, to, { recursive: true });
  console.log(`  ✔ ${name} → .next/standalone`);
}

console.log("خروجی standalone کامل شد.\n");
