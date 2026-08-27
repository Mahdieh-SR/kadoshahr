import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit, tooManyRequestsMessage } from "@/lib/rate-limit";
import { MAX_CART_LINES } from "@/lib/constants";

const bodySchema = z.object({
  variantIds: z.array(z.string().min(1).max(64)).max(MAX_CART_LINES),
});

/**
 * اطلاعات به‌روز کالاهای سبد را از دیتابیس برمی‌گرداند.
 *
 * سبد خرید در مرورگر کاربر (localStorage) ذخیره می‌شود و ممکن است قدیمی باشد؛
 * این مسیر قیمت و موجودی واقعی را برمی‌گرداند تا صفحه‌ی سبد همیشه عدد درست
 * نشان دهد. قیمتی که مرورگر فرستاده باشد هرگز خوانده نمی‌شود.
 */
export async function POST(request: Request) {
  const ip = await getClientIp();
  const limit = await rateLimit(`cart:${ip}`, 120, 60);
  if (!limit.ok) {
    return NextResponse.json(
      { ok: false, error: tooManyRequestsMessage(limit.retryAfterSeconds) },
      { status: 429 }
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "درخواست نامعتبر است." },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "درخواست نامعتبر است." },
      { status: 400 }
    );
  }

  const { variantIds } = parsed.data;
  if (variantIds.length === 0) {
    return NextResponse.json({ ok: true, items: [] });
  }

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
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

  const items = variants.map((v) => ({
    variantId: v.id,
    productSlug: v.product.slug,
    title: v.product.title,
    variantLabel: v.label,
    image: v.product.images[0] ?? null,
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    stock: v.stock,
    available: v.isActive && v.product.isActive && v.stock > 0,
  }));

  return NextResponse.json({ ok: true, items });
}
