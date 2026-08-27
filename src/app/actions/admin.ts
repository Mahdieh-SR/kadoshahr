"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getAdminOrNull } from "@/lib/session";
import { getClientIp, rateLimit, tooManyRequestsMessage } from "@/lib/rate-limit";
import {
  adminDiscountSchema,
  adminProductSchema,
  adminReviewSchema,
  adminUpdateOrderSchema,
} from "@/lib/validation";
import { recalculateProductRating } from "@/lib/reviews";
import { normalizeDiscountCode } from "@/lib/discount";

export type AdminResult = { ok: boolean; message?: string; error?: string };

const DENIED: AdminResult = {
  ok: false,
  error: "دسترسی ندارید. این عملیات فقط برای مدیر مجاز است.",
};

/** بررسی نقش + سقف درخواست، مشترک بین همه‌ی اکشن‌های ادمین */
async function guard(bucket: string) {
  const admin = await getAdminOrNull();
  if (!admin) return { admin: null, error: DENIED };

  const ip = await getClientIp();
  const limit = await rateLimit(`admin:${bucket}:${admin.id}:${ip}`, 60, 300);
  if (!limit.ok) {
    return {
      admin: null,
      error: {
        ok: false,
        error: tooManyRequestsMessage(limit.retryAfterSeconds),
      } as AdminResult,
    };
  }

  return { admin, error: null };
}

/* ─────────────────────────── سفارش‌ها ─────────────────────────── */

export async function updateOrderStatus(input: unknown): Promise<AdminResult> {
  const { admin, error } = await guard("order");
  if (!admin) return error!;

  const parsed = adminUpdateOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "اطلاعات وارد شده معتبر نیست.",
    };
  }

  const { orderId, status, deliveryNote } = parsed.data;

  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  });
  if (!existing) return { ok: false, error: "سفارش پیدا نشد." };

  await prisma.order.update({
    where: { id: orderId },
    data: {
      status,
      deliveryNote: deliveryNote ? deliveryNote : null,
    },
  });

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath(`/order/${orderId}/result`);
  revalidatePath("/account/orders");

  return { ok: true, message: "وضعیت سفارش به‌روز شد." };
}

/* ─────────────────────────── محصول‌ها ─────────────────────────── */

export async function saveProduct(input: unknown): Promise<AdminResult & { id?: string }> {
  const { admin, error } = await guard("product");
  if (!admin) return error!;

  const parsed = adminProductSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "اطلاعات وارد شده معتبر نیست.",
    };
  }

  const data = parsed.data;

  // دسته‌بندی باید واقعاً وجود داشته باشد
  const category = await prisma.category.findUnique({
    where: { id: data.categoryId },
    select: { id: true },
  });
  if (!category) return { ok: false, error: "دسته‌بندی انتخاب‌شده وجود ندارد." };

  // نشانی (slug) نباید تکراری باشد
  const clash = await prisma.product.findFirst({
    where: { slug: data.slug, ...(data.id ? { NOT: { id: data.id } } : {}) },
    select: { id: true },
  });
  if (clash) {
    return { ok: false, error: "این نشانی (slug) قبلاً برای محصول دیگری ثبت شده." };
  }

  const common = {
    title: data.title,
    slug: data.slug,
    description: data.description,
    categoryId: data.categoryId,
    images: data.images.filter(Boolean),
    isActive: data.isActive,
    isFeatured: data.isFeatured,
    specs: data.specs?.filter((s) => s.key && s.value) ?? [],
  };

  const variantData = data.variants.map((v) => ({
    label: v.label,
    platform: v.platform,
    region: v.region,
    capacity: v.capacity,
    price: v.price,
    compareAtPrice: v.compareAtPrice && v.compareAtPrice > 0 ? v.compareAtPrice : null,
    stock: v.stock,
    isActive: v.isActive,
  }));

  /* ── محصول جدید ── */
  if (!data.id) {
    const created = await prisma.product.create({
      data: { ...common, variants: { create: variantData } },
      select: { id: true },
    });
    revalidatePath("/admin/products");
    revalidatePath("/products");
    return { ok: true, message: "محصول ساخته شد.", id: created.id };
  }

  /* ── ویرایش محصول موجود ── */
  const current = await prisma.productVariant.findMany({
    where: { productId: data.id },
    select: { id: true, _count: { select: { orderItems: true } } },
  });

  const keptIds = new Set(
    data.variants.map((v) => v.id).filter((id): id is string => Boolean(id))
  );

  // وردایانتی که در سفارشی استفاده شده حذف نمی‌شود (سابقه‌ی سفارش را خراب می‌کند)؛
  // به‌جایش غیرفعال می‌شود تا در فروشگاه دیده نشود.
  const toDelete = current.filter(
    (v) => !keptIds.has(v.id) && v._count.orderItems === 0
  );
  const toDeactivate = current.filter(
    (v) => !keptIds.has(v.id) && v._count.orderItems > 0
  );

  await prisma.$transaction([
    prisma.product.update({ where: { id: data.id }, data: common }),

    ...toDelete.map((v) =>
      prisma.productVariant.delete({ where: { id: v.id } })
    ),
    ...toDeactivate.map((v) =>
      prisma.productVariant.update({
        where: { id: v.id },
        data: { isActive: false },
      })
    ),

    ...data.variants
      .filter((v) => v.id)
      .map((v, i) =>
        prisma.productVariant.update({
          where: { id: v.id! },
          data: variantData[data.variants.findIndex((x) => x.id === v.id)] ?? variantData[i]!,
        })
      ),

    ...data.variants
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => !v.id)
      .map(({ i }) =>
        prisma.productVariant.create({
          data: { ...variantData[i]!, productId: data.id! },
        })
      ),
  ]);

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${data.id}`);
  revalidatePath("/products");
  revalidatePath(`/product/${data.slug}`);

  return { ok: true, message: "تغییرات محصول ذخیره شد.", id: data.id };
}

export async function deleteProduct(productId: string): Promise<AdminResult> {
  const { admin, error } = await guard("product");
  if (!admin) return error!;

  if (typeof productId !== "string" || productId.length > 64) {
    return { ok: false, error: "شناسه‌ی محصول معتبر نیست." };
  }

  // اگر محصول در سفارشی استفاده شده، حذف نمی‌کنیم تا سابقه‌ی سفارش‌ها سالم بماند.
  const usedInOrders = await prisma.orderItem.count({
    where: { variant: { productId } },
  });

  if (usedInOrders > 0) {
    await prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });
    revalidatePath("/admin/products");
    revalidatePath("/products");
    return {
      ok: true,
      message:
        "این محصول در سفارش‌های قبلی استفاده شده، پس حذف نشد و فقط «غیرفعال» شد. دیگر در فروشگاه دیده نمی‌شود.",
    };
  }

  await prisma.product.delete({ where: { id: productId } });
  revalidatePath("/admin/products");
  revalidatePath("/products");
  return { ok: true, message: "محصول حذف شد." };
}

/* ─────────────────────────── کدهای تخفیف ─────────────────────────── */


export async function saveDiscount(
  input: unknown
): Promise<AdminResult & { id?: string }> {
  const { admin, error } = await guard("discount");
  if (!admin) return error!;

  const parsed = adminDiscountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "اطلاعات وارد شده معتبر نیست.",
    };
  }

  const d = parsed.data;
  const code = normalizeDiscountCode(d.code);

  // کد نباید تکراری باشد
  const clash = await prisma.discountCode.findFirst({
    where: { code, ...(d.id ? { NOT: { id: d.id } } : {}) },
    select: { id: true },
  });
  if (clash) return { ok: false, error: "این کد تخفیف قبلاً ثبت شده است." };

  const data = {
    code,
    type: d.type,
    value: d.value,
    minOrderAmount: d.minOrderAmount,
    maxDiscountAmount: d.type === "PERCENT" ? d.maxDiscountAmount : 0,
    usageLimit: d.usageLimit,
    perUserLimit: d.perUserLimit,
    startsAt: d.startsAt ? new Date(d.startsAt) : null,
    expiresAt: d.expiresAt ? new Date(d.expiresAt) : null,
    isActive: d.isActive,
    description: d.description ? d.description : null,
  };

  const saved = d.id
    ? await prisma.discountCode.update({
        where: { id: d.id },
        data,
        select: { id: true },
      })
    : await prisma.discountCode.create({ data, select: { id: true } });

  revalidatePath("/admin/discounts");
  return {
    ok: true,
    message: d.id ? "کد تخفیف به‌روز شد." : "کد تخفیف ساخته شد.",
    id: saved.id,
  };
}

export async function deleteDiscount(codeId: string): Promise<AdminResult> {
  const { admin, error } = await guard("discount");
  if (!admin) return error!;

  if (typeof codeId !== "string" || codeId.length > 64) {
    return { ok: false, error: "شناسه‌ی کد تخفیف معتبر نیست." };
  }

  // اگر از کد استفاده شده، حذفش نمی‌کنیم تا سابقه‌ی سفارش‌ها سالم بماند
  const used = await prisma.discountRedemption.count({ where: { codeId } });

  if (used > 0) {
    await prisma.discountCode.update({
      where: { id: codeId },
      data: { isActive: false },
    });
    revalidatePath("/admin/discounts");
    return {
      ok: true,
      message:
        "این کد قبلاً در سفارش‌هایی استفاده شده، پس حذف نشد و فقط «غیرفعال» شد.",
    };
  }

  await prisma.discountCode.delete({ where: { id: codeId } });
  revalidatePath("/admin/discounts");
  return { ok: true, message: "کد تخفیف حذف شد." };
}

/* ─────────────────────────── نظرات ─────────────────────────── */

export async function moderateReview(input: unknown): Promise<AdminResult> {
  const { admin, error } = await guard("review");
  if (!admin) return error!;

  const parsed = adminReviewSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "اطلاعات وارد شده معتبر نیست.",
    };
  }

  const { reviewId, status, adminReply } = parsed.data;

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, productId: true, product: { select: { slug: true } } },
  });
  if (!review) return { ok: false, error: "نظر پیدا نشد." };

  await prisma.review.update({
    where: { id: reviewId },
    data: { status, adminReply: adminReply ? adminReply : null },
  });

  // میانگین امتیاز محصول بعد از هر تایید/رد بازمحاسبه می‌شود
  await recalculateProductRating(review.productId);

  revalidatePath("/admin/reviews");
  revalidatePath(`/product/${review.product.slug}`);
  revalidatePath("/products");

  return {
    ok: true,
    message:
      status === "APPROVED"
        ? "نظر تایید و منتشر شد."
        : status === "REJECTED"
          ? "نظر رد شد و نمایش داده نمی‌شود."
          : "نظر به حالت «در انتظار تایید» برگشت.",
  };
}

export async function deleteReview(reviewId: string): Promise<AdminResult> {
  const { admin, error } = await guard("review");
  if (!admin) return error!;

  if (typeof reviewId !== "string" || reviewId.length > 64) {
    return { ok: false, error: "شناسه‌ی نظر معتبر نیست." };
  }

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { productId: true, product: { select: { slug: true } } },
  });
  if (!review) return { ok: false, error: "نظر پیدا نشد." };

  await prisma.review.delete({ where: { id: reviewId } });
  await recalculateProductRating(review.productId);

  revalidatePath("/admin/reviews");
  revalidatePath(`/product/${review.product.slug}`);

  return { ok: true, message: "نظر حذف شد." };
}
