/**
 * صفر کردن شمارنده‌های محدودیت نرخ.
 * وقتی موقع تست زیاد درخواست فرستادید و پیام «تعداد درخواست بیش از حد» گرفتید،
 * این را اجرا کنید:  npm run limits:reset
 */
import "dotenv/config";
import { Client } from "pg";

const db = new Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const { rowCount } = await db.query('DELETE FROM "RateLimit"');
await db.end();
console.log(`✔ ${rowCount} شمارنده‌ی محدودیت نرخ پاک شد.`);
