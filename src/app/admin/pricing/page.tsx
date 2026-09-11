import { requireAdmin } from "@/lib/session";
import {
  countUsdVariants,
  getPricingSettings,
  previewReprice,
} from "@/lib/exchange-rate";
import { UsdRateForm } from "@/components/admin/UsdRateForm";

export const metadata = { title: "نرخ دلار" };

export default async function AdminPricingPage() {
  await requireAdmin();

  const settings = await getPricingSettings();
  const usdVariantCount = await countUsdVariants();

  // پیش‌نمایش با نرخ فعلی — فرم خودش با تغییر عددها دوباره حساب می‌کند
  const samples = await previewReprice(
    settings.usdRate,
    settings.marginPercent,
    settings.roundTo
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-black">نرخ دلار</h1>
        <p className="mt-2 text-sm text-muted">
          قیمت گیفت‌کارت‌ها به دلار ثبت می‌شود و قیمت تومانی‌شان از روی این نرخ
          حساب می‌شود. هر بار نرخ را عوض کنید، قیمت همه‌ی محصولات دلاری با هم
          به‌روز می‌شود.
        </p>
      </div>

      <UsdRateForm
        settings={{
          usdRate: settings.usdRate,
          marginPercent: settings.marginPercent,
          roundTo: settings.roundTo,
          suggestedRate: settings.suggestedRate,
          suggestedAt: settings.suggestedAt?.toISOString() ?? null,
          suggestedFrom: settings.suggestedFrom,
          appliedAt: settings.appliedAt?.toISOString() ?? null,
        }}
        usdVariantCount={usdVariantCount}
        samples={samples}
      />
    </div>
  );
}
