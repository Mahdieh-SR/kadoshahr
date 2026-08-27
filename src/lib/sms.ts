/**
 * لایه‌ی ارسال پیامک.
 *
 * فعلاً فقط حالت "console" فعال است: کد تایید در ترمینال چاپ می‌شود.
 * برای وصل کردن پنل واقعی (کاوه‌نگار، ملی‌پیامک، …) کافی است یک شاخه‌ی جدید
 * به تابع sendOtpSms اضافه شود و SMS_PROVIDER در فایل .env تغییر کند —
 * بقیه‌ی کد برنامه دست نمی‌خورد.
 */

import { isDemoMode } from "./demo";

export type SmsResult = { delivered: boolean; provider: string };

export function isSmsConfigured(): boolean {
  const provider = process.env.SMS_PROVIDER ?? "console";
  return provider !== "console" && Boolean(process.env.SMS_API_KEY);
}

export async function sendOtpSms(
  phone: string,
  code: string
): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER ?? "console";

  if (provider === "console" || !process.env.SMS_API_KEY) {
    console.info(
      `\n──────── کد تایید ────────\n  شماره: ${phone}\n  کد   : ${code}\n──────────────────────────\n`
    );
    return { delivered: false, provider: "console" };
  }

  // TODO: وقتی پنل پیامک تهیه شد، فراخوانی واقعی اینجا اضافه می‌شود.
  console.warn(
    `پنل پیامک «${provider}» هنوز پیاده‌سازی نشده است؛ کد در ترمینال چاپ شد.`
  );
  console.info(`کد تایید برای ${phone}: ${code}`);
  return { delivered: false, provider };
}

/**
 * کد تایید فقط در دو حالت به مرورگر برگردانده می‌شود:
 *   ۱. حالت توسعه روی کامپیوتر خودمان
 *   ۲. «حالت نمایش» — دموی موقت برای کارفرما (DEMO_MODE=true)
 *
 * در هر دو حالت شرط این است که پنل پیامک وصل نباشد. به‌محض وصل شدن پنل
 * واقعی، کد دیگر هرگز روی صفحه نمی‌آید.
 */
export function shouldRevealCodeToClient(): boolean {
  if (isSmsConfigured()) return false;
  return process.env.NODE_ENV !== "production" || isDemoMode();
}
