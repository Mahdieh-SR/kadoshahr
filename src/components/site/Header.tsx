import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CartBadge } from "./CartBadge";
import { MobileMenu } from "./MobileMenu";
import { SearchIcon, SettingsIcon, UserIcon } from "@/components/ui/icons";

export async function Header() {
  const [session, categories] = await Promise.all([
    auth(),
    // دسته‌ی بدون محصول در منو نمی‌آید — کلیک روی آن به صفحه‌ی خالی می‌رسید
    prisma.category.findMany({
      where: { products: { some: { isActive: true } } },
      orderBy: { sortOrder: "asc" },
      select: { name: true, slug: true },
    }),
  ]);

  const navItems = [
    { href: "/products", label: "همه محصولات" },
    ...categories.map((c) => ({ href: `/category/${c.slug}`, label: c.name })),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-ink-800 bg-ink-950/85 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-400 text-sm font-black text-ink-950">
            ک
          </span>
          <span className="text-lg font-bold tracking-tight">کادوشهر</span>
        </Link>

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-ink-800 hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-1 items-center justify-end gap-2 md:flex-none">
          <Link
            href="/products"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700 text-fg transition-colors hover:border-ink-600 hover:bg-ink-800"
            aria-label="جستجوی محصولات"
          >
            <SearchIcon />
          </Link>

          <CartBadge />

          {session?.user?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="hidden h-10 items-center gap-2 rounded-xl border border-brand-500/50 px-3 text-sm text-brand-400 transition-colors hover:bg-brand-500/10 sm:flex"
            >
              <SettingsIcon width={18} height={18} />
              مدیریت
            </Link>
          )}

          <Link
            href={session?.user ? "/account" : "/login"}
            className="flex h-10 items-center gap-2 rounded-xl border border-ink-700 px-3 text-sm text-fg transition-colors hover:border-ink-600 hover:bg-ink-800"
          >
            <UserIcon width={18} height={18} />
            <span className="hidden sm:inline">
              {session?.user ? session.user.name || "حساب من" : "ورود"}
            </span>
          </Link>

          <MobileMenu items={navItems} />
        </div>
      </div>
    </header>
  );
}
