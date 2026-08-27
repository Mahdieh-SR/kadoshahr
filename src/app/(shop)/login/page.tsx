import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { OtpLoginForm } from "@/components/auth/OtpLoginForm";

export const metadata: Metadata = {
  title: "ورود یا ثبت‌نام",
};

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = await searchParams;

  // فقط مسیرهای داخلی پذیرفته می‌شوند تا کسی نتواند کاربر را بعد از ورود
  // به یک سایت بیرونی هدایت کند (open redirect).
  const safeCallback =
    callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/account";

  if (session?.user) redirect(safeCallback);

  return (
    <div className="container-page flex justify-center py-16 sm:py-24">
      <div className="w-full max-w-md">
        <header className="mb-8 text-center">
          <h1 className="text-2xl font-black">ورود یا ثبت‌نام</h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            شماره موبایل خود را وارد کنید. اگر قبلاً حساب نداشته باشید، همان لحظه
            برایتان ساخته می‌شود.
          </p>
        </header>

        <div className="rounded-card border border-ink-800 bg-ink-900 p-6 sm:p-8">
          <OtpLoginForm redirectTo={safeCallback} />
        </div>

        <p className="mt-6 text-center text-xs leading-6 text-muted">
          با ورود، قوانین و شرایط استفاده از فروشگاه را می‌پذیرید.
        </p>
      </div>
    </div>
  );
}
