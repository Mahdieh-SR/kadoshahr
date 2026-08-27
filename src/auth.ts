import NextAuth, { type Session } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { verifyOtp } from "@/lib/otp";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { verifyOtpSchema } from "@/lib/validation";

export type UserRole = "USER" | "ADMIN";

// اینترفیس‌های Session و User در بسته‌ی @auth/core تعریف شده‌اند و next-auth
// فقط آن‌ها را دوباره export می‌کند؛ پس افزودن فیلدهای اختصاصی باید روی همان
// ماژول اصلی انجام شود تا در کل پروژه شناخته شود.
declare module "@auth/core/types" {
  interface User {
    phone?: string;
    role?: UserRole;
  }
  interface Session {
    user: {
      id: string;
      phone: string;
      role: UserRole;
      name?: string | null;
      email?: string | null;
    };
  }
}

export const {
  handlers,
  auth,
  signIn,
  signOut,
  unstable_update: updateSession,
} = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },

  providers: [
    Credentials({
      id: "otp",
      name: "ورود با کد پیامکی",
      credentials: {
        phone: { label: "شماره موبایل", type: "text" },
        code: { label: "کد تایید", type: "text" },
      },

      async authorize(raw) {
        const parsed = verifyOtpSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { phone, code } = parsed.data;

        // سقف تلاش برای تایید کد — هم روی شماره، هم روی IP.
        // بدون این، می‌شد یک میلیون کد ۶ رقمی را امتحان کرد.
        const ip = await getClientIp();
        const byPhone = await rateLimit(`otp-verify:phone:${phone}`, 10, 600);
        const byIp = await rateLimit(`otp-verify:ip:${ip}`, 30, 600);
        if (!byPhone.ok || !byIp.ok) return null;

        const result = await verifyOtp(phone, code);
        if (!result.ok) return null;

        // ورود و ثبت‌نام یکی است: اگر کاربر نبود، ساخته می‌شود.
        const user = await prisma.user.upsert({
          where: { phone },
          update: {},
          create: { phone },
          select: { id: true, phone: true, name: true, email: true, role: true },
        });

        return {
          id: user.id,
          phone: user.phone,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.uid = user.id;
        token.phone = (user as { phone: string }).phone;
        token.role = (user as { role: "USER" | "ADMIN" }).role;
      }

      // بعد از ویرایش پروفایل، اطلاعات تازه از دیتابیس خوانده می‌شود.
      // نقش کاربر هم همیشه از دیتابیس می‌آید، نه از داده‌ی سمت کلاینت.
      if (trigger === "update" && token.uid) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.uid as string },
          select: { name: true, email: true, role: true },
        });
        if (fresh) {
          token.name = fresh.name;
          token.email = fresh.email;
          token.role = fresh.role;
        }
      }

      return token;
    },

    async session({ session, token }) {
      // یک شیء تازه برمی‌گردانیم به‌جای تغییر دادن session ورودی، چون تایپ
      // پارامتر ورودی بسته به حالت adapter/jwt یک union است.
      return {
        ...session,
        user: {
          ...session.user,
          id: token.uid as string,
          phone: token.phone as string,
          role: (token.role as UserRole) ?? "USER",
          name: (token.name as string | null) ?? null,
          email: (token.email as string | null) ?? null,
        },
      } as Session;
    },
  },
});
