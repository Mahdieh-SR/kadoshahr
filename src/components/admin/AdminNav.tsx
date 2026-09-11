"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import {
  BagIcon,
  CurrencyIcon,
  LogOutIcon,
  PackageIcon,
  SettingsIcon,
  SparkIcon,
  HeadsetIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const items = [
  { href: "/admin", label: "پیشخوان", icon: SettingsIcon, exact: true },
  { href: "/admin/orders", label: "سفارش‌ها", icon: PackageIcon },
  { href: "/admin/products", label: "محصولات", icon: BagIcon },
  { href: "/admin/pricing", label: "نرخ دلار", icon: CurrencyIcon },
  { href: "/admin/discounts", label: "کدهای تخفیف", icon: SparkIcon },
  { href: "/admin/reviews", label: "نظرات", icon: HeadsetIcon },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-colors",
              active
                ? "bg-ink-800 font-bold text-accent-400"
                : "text-muted hover:bg-ink-800 hover:text-fg"
            )}
          >
            <item.icon width={18} height={18} />
            {item.label}
          </Link>
        );
      })}

      <div className="mt-2 border-t border-ink-800 pt-2">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm text-muted transition-colors hover:bg-ink-800 hover:text-fg"
        >
          <BagIcon width={18} height={18} />
          دیدن فروشگاه
        </Link>

        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-muted transition-colors hover:bg-danger/10 hover:text-danger"
          >
            <LogOutIcon width={18} height={18} />
            خروج
          </button>
        </form>
      </div>
    </nav>
  );
}
