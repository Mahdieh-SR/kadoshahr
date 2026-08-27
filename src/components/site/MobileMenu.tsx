"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { CloseIcon, MenuIcon } from "@/components/ui/icons";

type Item = { href: string; label: string };

export function MobileMenu({ items }: { items: Item[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // با تغییر صفحه، منو خودش بسته شود
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700 text-fg md:hidden"
        aria-label="باز کردن منو"
      >
        <MenuIcon />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink-950/80"
            onClick={() => setOpen(false)}
            aria-label="بستن منو"
          />
          <nav className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col border-s border-ink-800 bg-ink-900 p-5">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-bold">منو</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-ink-800 hover:text-fg"
                aria-label="بستن منو"
              >
                <CloseIcon />
              </button>
            </div>

            <ul className="flex flex-col gap-1">
              {items.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-ink-800 hover:text-fg"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </>
  );
}
