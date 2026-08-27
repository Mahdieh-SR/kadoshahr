"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type CartLine = {
  variantId: string;
  productSlug: string;
  title: string;
  variantLabel: string;
  image: string | null;
  /** فقط برای نمایش در مرورگر — قیمت واقعی همیشه سمت سرور از دیتابیس خوانده می‌شود */
  price: number;
  quantity: number;
};

const STORAGE_KEY = "giftland.cart.v1";
const COUPON_KEY = "giftland.coupon.v1";
export const MAX_QTY_PER_ITEM = 10;

type CartContextValue = {
  lines: CartLine[];
  /** کد تخفیفی که کاربر وارد کرده — اعتبارش همیشه سمت سرور بررسی می‌شود */
  coupon: string;
  setCoupon: (code: string) => void;
  count: number;
  subtotal: number;
  ready: boolean;
  add: (line: Omit<CartLine, "quantity">, quantity: number) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

function readStorage(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (l): l is CartLine =>
        typeof l === "object" &&
        l !== null &&
        typeof (l as CartLine).variantId === "string" &&
        typeof (l as CartLine).quantity === "number"
    );
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [coupon, setCouponState] = useState("");
  // تا وقتی محتوای localStorage خوانده نشده، تعداد سبد را نمایش نمی‌دهیم
  // تا خروجی سرور و مرورگر با هم اختلاف پیدا نکند (hydration mismatch).
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(readStorage());
    try {
      setCouponState(window.localStorage.getItem(COUPON_KEY) ?? "");
    } catch {
      // اگر مرورگر اجازه‌ی ذخیره‌سازی نداد، بدون کد تخفیف ادامه می‌دهیم
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, ready]);

  // اگر سبد در تب دیگری تغییر کرد، این تب هم به‌روز شود
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setLines(readStorage());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback<CartContextValue["add"]>((line, quantity) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.variantId === line.variantId);
      if (existing) {
        return prev.map((l) =>
          l.variantId === line.variantId
            ? {
                ...l,
                ...line,
                quantity: Math.min(MAX_QTY_PER_ITEM, l.quantity + quantity),
              }
            : l
        );
      }
      return [...prev, { ...line, quantity: Math.min(MAX_QTY_PER_ITEM, quantity) }];
    });
  }, []);

  const setQuantity = useCallback<CartContextValue["setQuantity"]>(
    (variantId, quantity) => {
      setLines((prev) =>
        quantity <= 0
          ? prev.filter((l) => l.variantId !== variantId)
          : prev.map((l) =>
              l.variantId === variantId
                ? { ...l, quantity: Math.min(MAX_QTY_PER_ITEM, quantity) }
                : l
            )
      );
    },
    []
  );

  const remove = useCallback<CartContextValue["remove"]>((variantId) => {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  }, []);

  const setCoupon = useCallback((code: string) => {
    setCouponState(code);
    try {
      if (code) window.localStorage.setItem(COUPON_KEY, code);
      else window.localStorage.removeItem(COUPON_KEY);
    } catch {
      // ذخیره نشدن کد تخفیف مانع خرید نمی‌شود
    }
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setCoupon("");
  }, [setCoupon]);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      coupon,
      setCoupon,
      ready,
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
      subtotal: lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
      add,
      setQuantity,
      remove,
      clear,
    }),
    [lines, coupon, setCoupon, ready, add, setQuantity, remove, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart باید داخل CartProvider استفاده شود");
  return ctx;
}
