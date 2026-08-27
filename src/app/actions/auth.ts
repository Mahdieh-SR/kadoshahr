"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { verifyOtpSchema } from "@/lib/validation";

export type SignInState = { ok: boolean; error?: string };

/**
 * تایید کد و ورود.
 * خود بررسی کد داخل NextAuth (تابع authorize در src/auth.ts) انجام می‌شود
 * تا سشن و کوکی امن یک‌جا ساخته شوند.
 */
export async function signInWithOtp(
  phone: string,
  code: string,
  redirectTo?: string
): Promise<SignInState> {
  const parsed = verifyOtpSchema.safeParse({ phone, code });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "اطلاعات وارد شده معتبر نیست.",
    };
  }

  try {
    await signIn("otp", {
      phone: parsed.data.phone,
      code: parsed.data.code,
      redirect: false,
      redirectTo,
    });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        error: "کد وارد شده درست نیست یا منقضی شده. دوباره تلاش کنید.",
      };
    }
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
