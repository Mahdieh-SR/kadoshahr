import { prisma } from "./prisma";
import { MAX_QTY_PER_ITEM } from "./constants";

export type CartInputItem = { variantId: string; quantity: number };

export type PricedLine = {
  variantId: string;
  productSlug: string;
  productTitle: string;
  variantLabel: string;
  image: string | null;
  /** قیمت واحد — همیشه از دیتابیس، هرگز از ورودی کلاینت */
  unitPrice: number;
  compareAtPrice: number | null;
  quantity: number;
  lineTotal: number;
  stock: number;
};

export type PriceCartResult =
  | { ok: true; lines: PricedLine[]; subtotal: number; total: number }
  | { ok: false; error: string };

/**
 * سبد خرید کاربر را از روی دیتابیس قیمت‌گذاری می‌کند.
 *
 * ⚠️ نکته‌ی امنیتی کلیدی: از ورودی کلاینت فقط `variantId` و `quantity` خوانده
 * می‌شود. قیمت، عنوان و موجودی همگی از دیتابیس می‌آیند. حتی اگر کاربر مستقیم
 * به API درخواست بفرستد و قیمت دلخواه بگذارد، آن مقدار جایی استفاده نمی‌شود.
 */
export async function priceCart(
  items: CartInputItem[]
): Promise<PriceCartResult> {
  if (items.length === 0) {
    return { ok: false, error: "سبد خرید خالی است." };
  }

  // اگر کلاینت یک variantId را دو بار فرستاده باشد، تعدادها با هم جمع می‌شوند
  // تا نشود با تکرار، سقف تعداد را دور زد.
  const merged = new Map<string, number>();
  for (const item of items) {
    const qty = Math.floor(item.quantity);
    if (!Number.isFinite(qty) || qty < 1) {
      return { ok: false, error: "تعداد وارد شده معتبر نیست." };
    }
    merged.set(item.variantId, (merged.get(item.variantId) ?? 0) + qty);
  }

  for (const [, qty] of merged) {
    if (qty > MAX_QTY_PER_ITEM) {
      return {
        ok: false,
        error: `حداکثر تعداد مجاز برای هر کالا ${MAX_QTY_PER_ITEM} عدد است.`,
      };
    }
  }

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: [...merged.keys()] } },
    select: {
      id: true,
      label: true,
      price: true,
      compareAtPrice: true,
      stock: true,
      isActive: true,
      product: {
        select: { slug: true, title: true, images: true, isActive: true },
      },
    },
  });

  const byId = new Map(variants.map((v) => [v.id, v]));
  const lines: PricedLine[] = [];

  for (const [variantId, quantity] of merged) {
    const variant = byId.get(variantId);

    if (!variant || !variant.isActive || !variant.product.isActive) {
      return {
        ok: false,
        error: "یکی از کالاهای سبد دیگر در دسترس نیست. سبد را به‌روز کنید.",
      };
    }

    if (variant.stock < quantity) {
      return {
        ok: false,
        error: `موجودی «${variant.product.title}» کافی نیست (${variant.stock} عدد موجود است).`,
      };
    }

    lines.push({
      variantId: variant.id,
      productSlug: variant.product.slug,
      productTitle: variant.product.title,
      variantLabel: variant.label,
      image: variant.product.images[0] ?? null,
      unitPrice: variant.price,
      compareAtPrice: variant.compareAtPrice,
      quantity,
      lineTotal: variant.price * quantity,
      stock: variant.stock,
    });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  return { ok: true, lines, subtotal, total: subtotal };
}
