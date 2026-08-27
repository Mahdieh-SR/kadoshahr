import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { XCircleIcon } from "@/components/ui/icons";

export const metadata: Metadata = { title: "خطا در پرداخت" };

const reasons: Record<string, string> = {
  "missing-authority":
    "اطلاعات بازگشتی از درگاه ناقص بود. اگر مبلغی از حساب شما کم شده، طی ۷۲ ساعت برمی‌گردد.",
  "order-not-found":
    "سفارش متناظر با این تراکنش پیدا نشد. لطفاً با پشتیبانی تماس بگیرید.",
};

export default async function PaymentErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;

  return (
    <div className="container-page flex justify-center py-20">
      <div className="w-full max-w-md rounded-card border border-danger/40 bg-danger/5 p-8 text-center">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-danger/15 text-danger">
          <XCircleIcon width={34} height={34} />
        </span>

        <h1 className="mt-5 text-xl font-black">پرداخت پردازش نشد</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          {reasons[reason ?? ""] ??
            "در پردازش نتیجه‌ی پرداخت مشکلی پیش آمد. اگر مبلغی از حساب شما کم شده، طی ۷۲ ساعت به‌صورت خودکار برمی‌گردد."}
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <ButtonLink href="/account/orders">سفارش‌های من</ButtonLink>
          <ButtonLink href="/products" variant="secondary">
            بازگشت به فروشگاه
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
