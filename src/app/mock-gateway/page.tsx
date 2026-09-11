import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { isMockMode } from "@/lib/zarinpal";
import { formatToman } from "@/lib/format";
import { buttonClass } from "@/components/ui/Button";
import { ShieldIcon } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

/**
 * درگاه پرداخت ساختگی — جایگزین صفحه‌ی بانک در حالت تست.
 *
 * رفتارش عمداً دقیقاً مثل درگاه واقعی است:
 *   • فرم ساده‌ی HTML به یک آدرس جداگانه ارسال می‌شود
 *   • تصمیم کاربر (موفق/ناموفق) سمت سرور ثبت می‌شود
 *   • بعد کاربر با Authority و Status به آدرس بازگشت هدایت می‌شود
 *   • سایت برای فهمیدن نتیجه، دوباره از «درگاه» می‌پرسد — نه از آدرس مرورگر
 *
 * وقتی ZARINPAL_MODE روی live برود، این صفحه دیگر در دسترس نیست.
 */
export default async function MockGatewayPage({
  searchParams,
}: {
  searchParams: Promise<{ authority?: string }>;
}) {
  if (!isMockMode()) notFound();

  const { authority } = await searchParams;
  if (!authority) notFound();

  const payment = await prisma.mockPayment.findUnique({ where: { authority } });
  if (!payment) notFound();

  const order = await prisma.order.findUnique({
    where: { authority },
    select: { orderNumber: true, firstName: true, lastName: true },
  });

  const decided = payment.approved !== null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 p-5">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-center text-xs text-warning">
          حالت تست — این یک درگاه شبیه‌سازی‌شده است و پولی جابه‌جا نمی‌شود
        </div>

        <div className="rounded-card border border-ink-800 bg-ink-900 p-6 sm:p-8">
          <header className="flex items-center gap-3 border-b border-ink-800 pb-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink-800 text-accent-400">
              <ShieldIcon />
            </span>
            <div>
              <h1 className="text-base font-bold">درگاه پرداخت اینترنتی</h1>
              <p className="mt-0.5 text-xs text-muted">شبیه‌ساز زرین‌پال</p>
            </div>
          </header>

          <dl className="flex flex-col gap-4 py-6 text-sm">
            <Row label="پذیرنده" value="فروشگاه کادوشهر" />
            {order && <Row label="شماره سفارش" value={order.orderNumber} />}
            {order && (
              <Row
                label="نام پرداخت‌کننده"
                value={`${order.firstName} ${order.lastName}`}
              />
            )}
            <Row
              label="شماره پیگیری"
              value={
                <span dir="ltr" className="font-mono text-xs">
                  {authority.slice(0, 18)}…
                </span>
              }
            />
            <div className="flex items-baseline justify-between border-t border-ink-800 pt-4">
              <dt className="font-bold">مبلغ قابل پرداخت</dt>
              <dd className="text-lg font-black text-accent-400">
                {formatToman(payment.amount)}
              </dd>
            </div>
          </dl>

          {decided ? (
            <p className="rounded-xl border border-ink-700 bg-ink-800 px-4 py-3 text-center text-sm text-muted">
              این تراکنش قبلاً پردازش شده است.
            </p>
          ) : (
            /* فرم HTML معمولی — دقیقاً مثل درگاه واقعی که سایت جداگانه‌ای است */
            <form
              method="POST"
              action="/api/mock-gateway/decide"
              className="flex flex-col gap-3"
            >
              <input type="hidden" name="authority" value={authority} />

              <button
                type="submit"
                name="decision"
                value="approve"
                className={buttonClass("primary", "lg")}
              >
                پرداخت موفق ✅
              </button>

              <button
                type="submit"
                name="decision"
                value="reject"
                className={buttonClass("danger", "lg")}
              >
                انصراف / پرداخت ناموفق ❌
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs leading-6 text-muted">
          هر دو دکمه را امتحان کنید تا هر دو مسیر را ببینید.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-fg">{value}</dd>
    </div>
  );
}
