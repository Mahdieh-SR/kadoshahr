import { AccountNav } from "@/components/account/AccountNav";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // نگهبان دسترسی: هر صفحه‌ای زیر /account بدون ورود قابل دیدن نیست
  const user = await requireUser("/account");

  return (
    <div className="container-page py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-black">حساب کاربری</h1>
        <p dir="ltr" className="mt-2 text-start text-sm text-muted">
          {user.phone}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[240px_1fr] lg:items-start">
        <AccountNav />
        <div>{children}</div>
      </div>
    </div>
  );
}
