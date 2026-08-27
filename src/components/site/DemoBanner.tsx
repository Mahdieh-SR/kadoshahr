import { isDemoMode } from "@/lib/demo";

/**
 * نوار هشدار «نسخه‌ی نمایشی».
 *
 * وقتی DEMO_MODE روشن است، بالای همه‌ی صفحه‌ها دیده می‌شود تا هیچ‌کس
 * این نسخه را با فروشگاه واقعی اشتباه نگیرد و کسی سهواً پرداخت واقعی
 * انتظار نداشته باشد.
 */
export function DemoBanner() {
  if (!isDemoMode()) return null;

  return (
    <div className="bg-warning text-ink-950">
      <div className="container-page flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 text-center text-xs leading-6 font-bold">
        <span>نسخه‌ی نمایشی — پرداخت واقعی انجام نمی‌شود</span>
        <span className="hidden opacity-70 sm:inline">|</span>
        <span className="font-normal opacity-90">
          کد ورود روی همان صفحه نمایش داده می‌شود
        </span>
      </div>
    </div>
  );
}
