import { redirect } from "next/navigation";
import { auth } from "@/auth";

export type SessionUser = {
  id: string;
  phone: string;
  role: "USER" | "ADMIN";
  name?: string | null;
  email?: string | null;
};

/**
 * کاربر واردشده را برمی‌گرداند و اگر وارد نشده باشد به صفحه‌ی ورود می‌فرستد.
 * آدرس صفحه‌ی فعلی به‌عنوان callbackUrl پاس داده می‌شود تا بعد از ورود
 * کاربر به همان‌جا برگردد.
 */
export async function requireUser(callbackUrl?: string): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) {
    const target = callbackUrl
      ? `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/login";
    redirect(target);
  }
  return session.user;
}

/**
 * فقط ادمین‌ها اجازه دارند.
 *
 * ⚠️ بررسی «نقش» است، نه صرفاً «وارد شده بودن». نقش هم از توکن سشن خوانده
 * می‌شود که سمت سرور امضا شده و کاربر نمی‌تواند دستکاری‌اش کند.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=%2Fadmin");
  if (session.user.role !== "ADMIN") redirect("/account");
  return session.user;
}

/**
 * نسخه‌ی بدون ریدایرکت برای استفاده در Server Action ها.
 * اگر کاربر ادمین نباشد null برمی‌گرداند تا اکشن پیام خطا برگرداند.
 *
 * ⚠️ هر اکشن ادمین باید مستقلاً این را صدا بزند. نگهبان صفحه (layout) کافی
 * نیست، چون Server Action ها از بیرون هم قابل فراخوانی‌اند.
 */
export async function getAdminOrNull(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session.user;
}
