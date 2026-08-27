import Link from "next/link";
import { DiscountForm, emptyDiscount } from "@/components/admin/DiscountForm";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { requireAdmin } from "@/lib/session";

export default async function NewDiscountPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/discounts"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
        >
          <ChevronLeftIcon width={14} height={14} />
          بازگشت به کدهای تخفیف
        </Link>
        <h1 className="mt-3 text-xl font-black">کد تخفیف جدید</h1>
      </div>

      <DiscountForm initial={emptyDiscount} />
    </div>
  );
}
