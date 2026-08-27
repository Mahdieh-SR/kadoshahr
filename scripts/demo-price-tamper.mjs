/**
 * نمایش عملی: اگر کاربر قیمت ذخیره‌شده در مرورگرش را دستکاری کند چه می‌شود.
 * اجرا: node scripts/demo-price-tamper.mjs
 */
import "dotenv/config";
import { Client } from "pg";

const BASE = "http://localhost:3000";
const fa = new Intl.NumberFormat("fa-IR");

// یک محصول واقعی از دیتابیس برمی‌داریم
const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const { rows } = await db.query(
  `select v.id, v.label, v.price, p.title
     from "ProductVariant" v
     join "Product" p on p.id = v."productId"
    where v.price > 3000000
    order by v.price desc limit 1`
);
await db.end();

const real = rows[0];

console.log("\n════════════════════════════════════════════");
console.log("  محصول:", real.title);
console.log("  نسخه :", real.label);
console.log("  قیمت واقعی در دیتابیس:", fa.format(real.price), "تومان");
console.log("════════════════════════════════════════════\n");

console.log("حالا وانمود می‌کنیم کاربر سبد مرورگرش را دستکاری کرده");
console.log("و به‌جای قیمت واقعی نوشته: 1,000 تومان\n");

// دقیقاً همان چیزی که یک کاربر بدخواه می‌فرستد:
const tampered = {
  variantIds: [real.id],
  // این فیلدها را عمداً اضافه می‌کنیم تا ببینیم سرور نادیده‌شان می‌گیرد
  price: 1000,
  totalAmount: 1000,
  discount: 99,
};

console.log("درخواست ارسال‌شده به سرور:");
console.log("  " + JSON.stringify(tampered) + "\n");

const res = await fetch(`${BASE}/api/cart`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(tampered),
});
const data = await res.json();
const item = data.items?.[0];

console.log("پاسخ سرور:");
console.log("  قیمتی که سرور اعلام کرد:", fa.format(item.price), "تومان\n");

console.log("════════════════════════════════════════════");
if (item.price === real.price) {
  console.log("  ✅ سرور قیمت دستکاری‌شده را نادیده گرفت.");
  console.log("     قیمت از دیتابیس خوانده شد، نه از مرورگر کاربر.");
} else {
  console.log("  ❌ خطر! سرور قیمت کاربر را قبول کرد.");
}
console.log("════════════════════════════════════════════\n");
