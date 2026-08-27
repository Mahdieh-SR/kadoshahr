import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { DemoBanner } from "@/components/site/DemoBanner";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "پنل مدیریت" };
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 🔒 نگهبان دسترسی: «نقش» بررسی می‌شود، نه فقط وارد بودن.
  // کاربر عادی که آدرس /admin را حدس بزند به /account فرستاده می‌شود.
  const admin = await requireAdmin();

  return (
    <div className="min-h-screen bg-ink-950">
      <DemoBanner />
      <header className="border-b border-ink-800 bg-ink-900">
        <div className="container-page flex h-16 items-center justify-between gap-4">
          <Link href="/admin" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-black text-fg">
              م
            </span>
            <span className="font-bold">پنل مدیریت</span>
          </Link>

          <span className="text-xs text-muted">
            {admin.name || "مدیر"} — <span dir="ltr">{admin.phone}</span>
          </span>
        </div>
      </header>

      <div className="container-page grid gap-8 py-8 lg:grid-cols-[220px_1fr] lg:items-start">
        <aside className="rounded-card border border-ink-800 bg-ink-900 p-3 lg:sticky lg:top-8">
          <AdminNav />
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
