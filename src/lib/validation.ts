import { z } from "zod";
import { toLatinDigits } from "./format";
import { isValidLocation, provinceNames } from "@/data/iran-locations";

/**
 * شماره موبایل ایرانی را به شکل یکدست «09xxxxxxxxx» درمی‌آورد.
 * ورودی‌های +989…، 00989…، 989… و 9… هم پذیرفته می‌شوند.
 * اگر شماره معتبر نباشد null برمی‌گرداند.
 */
export function normalizePhone(raw: string): string | null {
  const digits = toLatinDigits(String(raw ?? ""))
    .replace(/[\s\-()]/g, "")
    .replace(/^\+/, "");

  let n = digits;
  if (n.startsWith("0098")) n = n.slice(4);
  else if (n.startsWith("98")) n = n.slice(2);
  if (n.startsWith("0")) n = n.slice(1);

  return /^9\d{9}$/.test(n) ? `0${n}` : null;
}

export const phoneSchema = z
  .string()
  .transform((v) => normalizePhone(v))
  .refine((v): v is string => v !== null, "شماره موبایل معتبر نیست");

export const otpCodeSchema = z
  .string()
  .transform((v) => toLatinDigits(String(v ?? "")).trim())
  .refine((v) => /^\d{6}$/.test(v), "کد تایید باید ۶ رقم باشد");

export const requestOtpSchema = z.object({
  phone: phoneSchema,
  /**
   * تله‌ی ضدبات: این فیلد در فرم مخفی است و کاربر واقعی هرگز پرش نمی‌کند.
   * عمداً اینجا رد نمی‌شود — اعتبارسنجی قبولش می‌کند و تصمیم‌گیری در خود مسیر
   * API انجام می‌شود تا بات پاسخ «موفق» بگیرد و نفهمد شناسایی شده است.
   */
  website: z.string().max(200).optional(),
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
});

/**
 * کد پستی ایران: دقیقاً ۱۰ رقم.
 * عمداً سخت‌گیرتر از این نیست تا کد پستی‌های واقعی به اشتباه رد نشوند؛
 * فقط حالت‌های آشکارا غلط (مثل ۱۰ رقم یکسان) گرفته می‌شود.
 */
export const postalCodeSchema = z
  .string({ error: "کد پستی را وارد کنید" })
  .transform((v) => toLatinDigits(String(v ?? "")).replace(/[\s-]/g, ""))
  .refine((v) => /^\d{10}$/.test(v), "کد پستی باید دقیقاً ۱۰ رقم باشد")
  .refine((v) => !/^(\d)\1{9}$/.test(v), "کد پستی وارد شده معتبر نیست");

/** فیلدهای آدرس پستی — هم در پروفایل و هم در تسویه‌حساب استفاده می‌شود */
export const addressSchema = z
  .object({
    province: z
      .string({ error: "استان را انتخاب کنید" })
      .trim()
      .min(1, "استان را انتخاب کنید")
      .refine((v) => provinceNames.includes(v), "استان انتخاب‌شده معتبر نیست"),
    city: z.string({ error: "شهر را انتخاب کنید" }).trim().min(1, "شهر را انتخاب کنید"),
    address: z
      .string({ error: "نشانی پستی را وارد کنید" })
      .trim()
      .min(10, "نشانی را کامل‌تر بنویسید (حداقل ۱۰ کاراکتر)")
      .max(500, "نشانی طولانی‌تر از حد مجاز است"),
    postalCode: postalCodeSchema,
  })
  // شهر باید واقعاً متعلق به همان استان باشد؛ وگرنه می‌شد با درخواست مستقیم
  // به API هر ترکیبی فرستاد.
  .refine((v) => isValidLocation(v.province, v.city), {
    error: "شهر انتخاب‌شده با استان هم‌خوانی ندارد",
    path: ["city"],
  });

/** یک آیتم سبد خرید همان‌طور که از مرورگر می‌رسد. قیمت عمداً پذیرفته نمی‌شود. */
export const cartItemInputSchema = z.object({
  variantId: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(10),
});

/** اطلاعات گیرنده، بدون آدرس */
const recipientSchema = z.object({
  firstName: z.string().trim().min(2, "نام را وارد کنید").max(50),
  lastName: z.string().trim().min(2, "نام خانوادگی را وارد کنید").max(50),
  email: z.email("ایمیل معتبر نیست").max(120),
});

/**
 * ورودی تسویه‌حساب = اطلاعات گیرنده + آدرس پستی + اقلام سبد.
 * آدرس اجباری است چون سفارش‌ها پستی ارسال می‌شوند.
 */
export const checkoutSchema = recipientSchema
  .extend({
    items: z
      .array(cartItemInputSchema)
      .min(1, "سبد خرید خالی است")
      .max(20, "تعداد اقلام سبد بیش از حد مجاز است"),
    /** کد تخفیف اختیاری — اعتبار و مبلغش کاملاً سمت سرور بررسی می‌شود */
    discountCode: z.string().max(32).optional().nullable(),
  })
  .and(addressSchema);

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(2, "نام را وارد کنید").max(80),
    email: z.email("ایمیل معتبر نیست").max(120),
  })
  .and(addressSchema);

export const orderStatusSchema = z.enum(
  ["PENDING_PAYMENT", "PAID", "DELIVERED", "FAILED", "CANCELLED"],
  { error: "وضعیت انتخاب‌شده معتبر نیست" }
);

export const adminUpdateOrderSchema = z.object({
  orderId: z.string().min(1).max(64),
  status: orderStatusSchema,
  deliveryNote: z.string().trim().max(2000).optional().or(z.literal("")),
});


/** ثبت نظر توسط مشتری */
export const reviewSchema = z.object({
  productId: z.string().min(1).max(64),
  rating: z
    .number({ error: "امتیاز را انتخاب کنید" })
    .int()
    .min(1, "امتیاز باید بین ۱ تا ۵ باشد")
    .max(5, "امتیاز باید بین ۱ تا ۵ باشد"),
  comment: z
    .string({ error: "متن نظر را بنویسید" })
    .trim()
    .min(10, "نظر شما خیلی کوتاه است (حداقل ۱۰ کاراکتر)")
    .max(1000, "نظر طولانی‌تر از حد مجاز است"),
});

/** تایید یا رد نظر توسط مدیر */
export const adminReviewSchema = z.object({
  reviewId: z.string().min(1).max(64),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"], {
    error: "وضعیت انتخاب‌شده معتبر نیست",
  }),
  adminReply: z.string().trim().max(1000).optional().or(z.literal("")),
});

/** ساخت و ویرایش کد تخفیف در پنل ادمین */
export const adminDiscountSchema = z
  .object({
    id: z.string().max(64).optional(),
    code: z
      .string({ error: "کد تخفیف را وارد کنید" })
      .trim()
      .min(3, "کد تخفیف حداقل ۳ کاراکتر باشد")
      .max(32, "کد تخفیف طولانی‌تر از حد مجاز است")
      .regex(
        /^[A-Za-z0-9_-]+$/,
        "کد فقط می‌تواند شامل حروف انگلیسی، عدد، خط تیره و زیرخط باشد"
      ),
    type: z.enum(["PERCENT", "FIXED"], { error: "نوع تخفیف را انتخاب کنید" }),
    value: z.number().int().min(1, "مقدار تخفیف باید بیشتر از صفر باشد"),
    minOrderAmount: z.number().int().min(0).max(1_000_000_000),
    maxDiscountAmount: z.number().int().min(0).max(1_000_000_000),
    usageLimit: z.number().int().min(0).max(1_000_000),
    perUserLimit: z.number().int().min(0).max(1000),
    startsAt: z.string().max(40).nullable().optional(),
    expiresAt: z.string().max(40).nullable().optional(),
    isActive: z.boolean(),
    description: z.string().trim().max(200).optional().or(z.literal("")),
  })
  // تخفیف درصدی نمی‌تواند بیشتر از ۱۰۰٪ باشد
  .refine((v) => v.type !== "PERCENT" || v.value <= 100, {
    error: "تخفیف درصدی نمی‌تواند بیشتر از ۱۰۰ باشد",
    path: ["value"],
  })
  // تخفیف مبلغی باید عدد منطقی باشد
  .refine((v) => v.type !== "FIXED" || v.value >= 1000, {
    error: "تخفیف مبلغی باید حداقل ۱٬۰۰۰ تومان باشد",
    path: ["value"],
  })
  .refine(
    (v) =>
      !v.startsAt ||
      !v.expiresAt ||
      new Date(v.startsAt) < new Date(v.expiresAt),
    { error: "تاریخ پایان باید بعد از تاریخ شروع باشد", path: ["expiresAt"] }
  );

export type AdminDiscountInput = z.infer<typeof adminDiscountSchema>;

const variantInputSchema = z.object({
  id: z.string().max(64).optional(),
  label: z.string().trim().min(1, "عنوان وردایانت لازم است").max(80),
  platform: z.string().trim().min(1, "پلتفرم لازم است").max(40),
  region: z.string().trim().min(1, "ریجن لازم است").max(40),
  capacity: z.string().trim().min(1, "حجم/مقدار لازم است").max(40),
  price: z.number().int().min(1000, "قیمت باید حداقل ۱٬۰۰۰ تومان باشد").max(1_000_000_000),
  compareAtPrice: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  stock: z.number().int().min(0).max(100000),
  isActive: z.boolean(),
});

export const adminProductSchema = z.object({
  id: z.string().max(64).optional(),
  title: z.string().trim().min(2, "عنوان محصول لازم است").max(120),
  slug: z
    .string()
    .trim()
    .min(2, "نشانی (slug) لازم است")
    .max(120)
    .regex(/^[a-z0-9-]+$/, "نشانی فقط می‌تواند شامل حروف انگلیسی کوچک، عدد و خط تیره باشد"),
  description: z.string().trim().min(10, "توضیحات حداقل ۱۰ کاراکتر باشد").max(5000),
  categoryId: z.string().min(1, "دسته‌بندی را انتخاب کنید").max(64),
  images: z.array(z.string().trim().max(500)).max(8),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  specs: z
    .array(z.object({ key: z.string().trim().max(60), value: z.string().trim().max(200) }))
    .max(20)
    .optional(),
  variants: z.array(variantInputSchema).min(1, "حداقل یک وردایانت لازم است").max(40),
});

export type AdminProductInput = z.infer<typeof adminProductSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
