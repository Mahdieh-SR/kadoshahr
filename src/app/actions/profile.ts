"use server";

import { revalidatePath } from "next/cache";
import { auth, updateSession } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getClientIp, rateLimit, tooManyRequestsMessage } from "@/lib/rate-limit";
import { updateProfileSchema } from "@/lib/validation";

export type ProfileState = { ok: boolean; message?: string; error?: string };

export async function updateProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  // ۱) فقط کاربر واردشده
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, error: "برای ویرایش اطلاعات باید وارد شوید." };
  }

  // ۲) سقف تعداد درخواست — این مسیر در دیتابیس تغییر ایجاد می‌کند
  const ip = await getClientIp();
  const limit = await rateLimit(`profile:${session.user.id}:${ip}`, 20, 600);
  if (!limit.ok) {
    return { ok: false, error: tooManyRequestsMessage(limit.retryAfterSeconds) };
  }

  // ۳) اعتبارسنجی سمت سرور — فرض نمی‌کنیم ورودی از فرم UI آمده است
  const parsed = updateProfileSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    province: formData.get("province"),
    city: formData.get("city"),
    address: formData.get("address"),
    postalCode: formData.get("postalCode"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "اطلاعات وارد شده معتبر نیست.",
    };
  }

  // شناسه‌ی کاربر از سشن گرفته می‌شود، نه از فرم — وگرنه می‌شد
  // با تغییر یک فیلد مخفی، اطلاعات کاربر دیگری را ویرایش کرد.
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: parsed.data.name,
      email: parsed.data.email,
      province: parsed.data.province,
      city: parsed.data.city,
      address: parsed.data.address,
      postalCode: parsed.data.postalCode,
    },
  });

  // سشن هم به‌روز می‌شود تا نام جدید بلافاصله در هدر دیده شود
  await updateSession({});
  revalidatePath("/account");

  return { ok: true, message: "اطلاعات حساب ذخیره شد." };
}
