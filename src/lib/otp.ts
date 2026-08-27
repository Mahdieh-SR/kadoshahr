import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";

export const OTP_TTL_SECONDS = 120;
export const OTP_MAX_ATTEMPTS = 5;
/** فاصله‌ی لازم بین دو درخواست کد برای یک شماره */
export const OTP_RESEND_COOLDOWN_SECONDS = 60;

function hashCode(phone: string, code: string): string {
  const secret = process.env.AUTH_SECRET ?? "";
  return createHash("sha256").update(`${phone}:${code}:${secret}`).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/** کد ۶ رقمی با مولد امن (نه Math.random) */
export function generateOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** آخرین کد فعال این شماره را برمی‌گرداند — برای اعمال فاصله‌ی ارسال مجدد. */
export async function secondsUntilResendAllowed(
  phone: string
): Promise<number> {
  const latest = await prisma.otpCode.findFirst({
    where: { phone },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (!latest) return 0;
  const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000;
  return Math.max(0, Math.ceil(OTP_RESEND_COOLDOWN_SECONDS - elapsed));
}

/**
 * یک کد جدید می‌سازد، هش آن را ذخیره می‌کند و کدهای قبلی همان شماره را باطل می‌کند.
 * متن خام کد فقط برگردانده می‌شود تا پیامک شود — هرگز ذخیره نمی‌شود.
 */
export async function issueOtp(phone: string): Promise<string> {
  const code = generateOtpCode();

  await prisma.$transaction([
    // کدهای قبلی همین شماره را مصرف‌شده علامت می‌زنیم تا فقط آخرین کد کار کند
    prisma.otpCode.updateMany({
      where: { phone, consumedAt: null },
      data: { consumedAt: new Date() },
    }),
    prisma.otpCode.create({
      data: {
        phone,
        codeHash: hashCode(phone, code),
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      },
    }),
  ]);

  return code;
}

export type OtpVerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * کد واردشده را بررسی می‌کند. در صورت موفقیت، کد را مصرف‌شده علامت می‌زند
 * تا دوباره قابل استفاده نباشد.
 */
export async function verifyOtp(
  phone: string,
  code: string
): Promise<OtpVerifyResult> {
  const record = await prisma.otpCode.findFirst({
    where: { phone, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!record) {
    return { ok: false, reason: "کدی برای این شماره ثبت نشده. دوباره درخواست کد بدهید." };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "کد منقضی شده است. کد جدید بگیرید." };
  }

  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false, reason: "تعداد تلاش‌های اشتباه زیاد بود. کد جدید بگیرید." };
  }

  if (!safeEqual(record.codeHash, hashCode(phone, code))) {
    await prisma.otpCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    const left = OTP_MAX_ATTEMPTS - record.attempts - 1;
    return {
      ok: false,
      reason:
        left > 0
          ? `کد وارد شده درست نیست. ${left} تلاش دیگر باقی مانده.`
          : "کد وارد شده درست نیست. کد جدید بگیرید.",
    };
  }

  await prisma.otpCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });

  return { ok: true };
}
