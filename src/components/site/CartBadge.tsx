"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { CartIcon } from "@/components/ui/icons";
import { formatNumber } from "@/lib/format";

export function CartBadge() {
  const { count, ready } = useCart();

  return (
    <Link
      href="/cart"
      className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-ink-700 text-fg transition-colors hover:border-ink-600 hover:bg-ink-800"
      aria-label={`سبد خرید${ready && count > 0 ? ` — ${count} کالا` : ""}`}
    >
      <CartIcon />
      {ready && count > 0 && (
        <span className="absolute -top-1.5 -left-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent-400 px-1 text-[11px] font-bold text-ink-950">
          {formatNumber(count)}
        </span>
      )}
    </Link>
  );
}
