import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPayment } from "@/lib/zarinpal";

/**
 * ─────────────────────────────────────────────────────────────
 *  بازگشت از درگاه پرداخت
 * ─────────────────────────────────────────────────────────────
 *
 *  زرین‌پال کاربر را با ?Authority=...&Status=OK به این آدرس برمی‌گرداند.
 *
 *  ⚠️ قانون طلایی: پارامتر Status هرگز مبنای تصمیم نیست.
 *  کاربر می‌تواند در نوار آدرس مرورگر Status=NOK را به Status=OK تغییر دهد.
 *  تنها چیزی که پذیرفته می‌شود، پاسخ درخواست سرور‌به‌سرور به API زرین‌پال است.
 *
 *  مبلغی هم که برای تایید فرستاده می‌شود از رکورد سفارش در دیتابیس خوانده
 *  می‌شود، نه از آدرس برگشتی.
 * ─────────────────────────────────────────────────────────────
 */

const base = () => process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

function redirectTo(path: string) {
  return NextResponse.redirect(new URL(path, base()));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  // زرین‌پال با حرف بزرگ می‌فرستد؛ برای اطمینان هر دو حالت را می‌خوانیم.
  const authority =
    url.searchParams.get("Authority") ?? url.searchParams.get("authority");
  const status = url.searchParams.get("Status") ?? url.searchParams.get("status");

  if (!authority) {
    return redirectTo("/payment-error?reason=missing-authority");
  }

  const order = await prisma.order.findUnique({
    where: { authority },
    select: {
      id: true,
      status: true,
      totalAmount: true,
      discountAmount: true,
      discountCodeId: true,
      userId: true,
      items: { select: { variantId: true, quantity: true } },
    },
  });

  if (!order) {
    return redirectTo("/payment-error?reason=order-not-found");
  }

  // اگر قبلاً همین سفارش پردازش شده، دوباره پردازش نمی‌کنیم.
  // (کاربر ممکن است صفحه‌ی بازگشت را رفرش کند یا دکمه‌ی back بزند.)
  if (order.status !== "PENDING_PAYMENT") {
    return redirectTo(`/order/${order.id}/result`);
  }

  // اگر کاربر در درگاه انصراف داده باشد، Status برابر NOK است.
  // این فقط یک «میان‌بر» است: باز هم موفق بودن را از روی آن تشخیص نمی‌دهیم،
  // فقط وقتی صراحتاً NOK باشد از تماس اضافه با درگاه صرف‌نظر می‌کنیم.
  if (status && status.toUpperCase() !== "OK") {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: "FAILED",
        failureReason: "پرداخت در درگاه لغو شد یا ناموفق بود.",
      },
    });
    return redirectTo(`/order/${order.id}/result`);
  }

  // ⬅ تصمیم واقعی اینجا گرفته می‌شود: تماس سرور‌به‌سرور با درگاه
  const result = await verifyPayment({
    authority,
    amountToman: order.totalAmount,
  });

  if (!result.ok) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "FAILED", failureReason: result.error },
    });
    return redirectTo(`/order/${order.id}/result`);
  }

  /* ─────────────────────────────────────────────────────────────
   * گام ۱ — ثبت وضعیت پرداخت
   *
   * این مهم‌ترین نوشتن است و جداگانه و سریع انجام می‌شود. اگر همه‌چیز را
   * در یک تراکنش بزرگ می‌گذاشتیم، کند شدن شبکه می‌توانست باعث شود پول
   * گرفته شده باشد ولی سفارش «در انتظار پرداخت» بماند.
   * ───────────────────────────────────────────────────────────── */
  await prisma.order.update({
    where: { id: order.id },
    data: {
      status: "PAID",
      refId: result.refId,
      cardPan: result.cardPan,
      paidAt: new Date(),
      failureReason: null,
    },
  });

  /* ─────────────────────────────────────────────────────────────
   * گام ۲ — کارهای جانبی: کم کردن موجودی، شمارش فروش، ثبت کد تخفیف
   *
   * مهلت تراکنش سخاوتمندانه است چون دیتابیس روی سرور اروپاست و هر
   * رفت‌وبرگشت زمان می‌برد. اگر باز هم شکست خورد، تک‌تک تلاش می‌شوند
   * تا حداقل بخشی از کار انجام شود.
   * ───────────────────────────────────────────────────────────── */
  const sideEffects = () => [
    // کم کردن موجودی و افزایش شمارنده‌ی فروش در یک دستور، نه دو تا
    ...order.items.map((item) =>
      prisma.productVariant.update({
        where: { id: item.variantId },
        data: {
          stock: { decrement: item.quantity },
          product: { update: { soldCount: { increment: item.quantity } } },
        },
      })
    ),

    // استفاده از کد تخفیف فقط بعد از پرداخت موفق ثبت می‌شود، نه هنگام ثبت
    // سفارش — وگرنه سفارش‌های رهاشده ظرفیت کد را الکی مصرف می‌کردند.
    ...(order.discountCodeId
      ? [
          prisma.discountCode.update({
            where: { id: order.discountCodeId },
            data: { usedCount: { increment: 1 } },
          }),
          prisma.discountRedemption.create({
            data: {
              codeId: order.discountCodeId,
              userId: order.userId,
              orderId: order.id,
              amount: order.discountAmount,
            },
          }),
        ]
      : []),
  ];

  try {
    await prisma.$transaction(sideEffects(), {
      timeout: 30_000,
      maxWait: 15_000,
    });
  } catch (error) {
    console.error("تراکنش کارهای جانبی شکست خورد؛ تک‌تک تلاش می‌شود:", error);

    // تلاش انفرادی — اگر یکی شکست خورد، بقیه انجام شوند
    const failures: string[] = [];
    for (const operation of sideEffects()) {
      try {
        await operation;
      } catch (e) {
        failures.push(String(e));
      }
    }

    if (failures.length > 0) {
      console.error("کارهای جانبی ناتمام ماند:", failures);
      await prisma.order
        .update({
          where: { id: order.id },
          data: {
            deliveryNote:
              "⚠️ پرداخت موفق بود ولی به‌روزرسانی موجودی یا ثبت کد تخفیف کامل نشد — دستی بررسی شود.",
          },
        })
        .catch(() => undefined);
    }
  }

  return redirectTo(`/order/${order.id}/result`);
}

/** بعضی درگاه‌ها با POST برمی‌گردند؛ همان منطق GET اجرا می‌شود. */
export async function POST(request: Request) {
  return GET(request);
}
