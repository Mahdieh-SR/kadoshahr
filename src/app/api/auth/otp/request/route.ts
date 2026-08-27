import { NextResponse } from "next/server";
import {
  OTP_RESEND_COOLDOWN_SECONDS,
  OTP_TTL_SECONDS,
  issueOtp,
  secondsUntilResendAllowed,
} from "@/lib/otp";
import { getClientIp, rateLimit, tooManyRequestsMessage } from "@/lib/rate-limit";
import { sendOtpSms, shouldRevealCodeToClient } from "@/lib/sms";
import { requestOtpSchema } from "@/lib/validation";

/**
 * درخواست کد تایید.
 *
 * لایه‌های محافظت در برابر بات (به ترتیب اجرا):
 *  ۱. فیلد تله (honeypot) — در فرم مخفی است؛ اگر پر شده باشد یعنی بات پرش کرده.
 *  ۲. سقف درخواست بر اساس IP — جلوی ساخت انبوه حساب جعلی را می‌گیرد.
 *  ۳. سقف درخواست بر اساس شماره موبایل — جلوی بمباران پیامک یک نفر را می‌گیرد.
 *  ۴. فاصله‌ی اجباری بین دو ارسال برای یک شماره.
 *
 * بدون این‌ها یک بات می‌توانست هزاران پیامک بفرستد و هزینه‌ی پنل را بترکاند.
 */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "درخواست نامعتبر است." },
      { status: 400 }
    );
  }

  const parsed = requestOtpSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "شماره موبایل معتبر نیست.",
      },
      { status: 400 }
    );
  }

  const { phone, website } = parsed.data;

  // ۱) تله‌ی ضدبات — به بات پاسخ موفق می‌دهیم تا متوجه نشود لو رفته،
  //    ولی هیچ پیامکی ارسال نمی‌شود.
  if (website) {
    return NextResponse.json({ ok: true, expiresInSeconds: OTP_TTL_SECONDS });
  }

  // ۲) سقف بر اساس IP
  const ip = await getClientIp();
  const byIp = await rateLimit(`otp-request:ip:${ip}`, 10, 3600);
  if (!byIp.ok) {
    return NextResponse.json(
      { ok: false, error: tooManyRequestsMessage(byIp.retryAfterSeconds) },
      { status: 429 }
    );
  }

  // ۳) سقف بر اساس شماره موبایل
  const byPhone = await rateLimit(`otp-request:phone:${phone}`, 5, 3600);
  if (!byPhone.ok) {
    return NextResponse.json(
      { ok: false, error: tooManyRequestsMessage(byPhone.retryAfterSeconds) },
      { status: 429 }
    );
  }

  // ۴) فاصله‌ی اجباری بین دو ارسال
  const wait = await secondsUntilResendAllowed(phone);
  if (wait > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `برای ارسال مجدد کد، ${wait} ثانیه صبر کنید.`,
        retryAfterSeconds: wait,
      },
      { status: 429 }
    );
  }

  const code = await issueOtp(phone);
  await sendOtpSms(phone, code);

  return NextResponse.json({
    ok: true,
    phone,
    expiresInSeconds: OTP_TTL_SECONDS,
    resendAfterSeconds: OTP_RESEND_COOLDOWN_SECONDS,
    // فقط در حالت توسعه و تا وقتی پنل پیامک وصل نشده، کد برگردانده می‌شود
    // تا بشود بدون پیامک تست کرد. در production هرگز این فیلد ارسال نمی‌شود.
    devCode: shouldRevealCodeToClient() ? code : undefined,
  });
}
