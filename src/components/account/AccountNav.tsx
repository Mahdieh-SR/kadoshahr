"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import {
  LogOutIcon,
  PackageIcon,
  SettingsIcon,
  UserIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/cn";

const items = [
  { href: "/account", label: "پیشخوان", icon: UserIcon },
  { href: "/account/orders", label: "سفارش‌های من", icon: PackageIcon },
  { href: "/account/profile", label: "اطلاعات حساب", icon: SettingsIcon },
];

export function AccountNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 rounded-card border border-ink-800 bg-ink-900 p-3">
      {items.map((item) => {
        const active = pathname === item.href;
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

      <form action={signOutAction} className="mt-1 border-t border-ink-800 pt-1">
        <button
          type="submit"
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-muted transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <LogOutIcon width={18} height={18} />
          خروج از حساب
        </button>
      </form>
    </nav>
  );
}
