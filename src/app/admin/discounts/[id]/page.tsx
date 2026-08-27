import Link from "next/link";
import { notFound } from "next/navigation";
import { DiscountForm } from "@/components/admin/DiscountForm";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatDateTime, formatNumber, formatToman } from "@/lib/format";

/** تبدیل تاریخ به قالبی که input[type=datetime-local] می‌فهمد */
function toLocalInput(date: Date | null): string {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function EditDiscountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const code = await prisma.discountCode.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      type: true,
      value: true,
      minOrderAmount: true,
      maxDiscountAmount: true,
      usageLimit: true,
      usedCount: true,
      perUserLimit: true,
      startsAt: true,
      expiresAt: true,
      isActive: true,
      description: true,
      redemptions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          amount: true,
          createdAt: true,
          order: { select: { id: true, orderNumber: true } },
          user: { select: { phone: true, name: true } },
        },
      },
    },
  });

  if (!code) notFound();

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
        <h1 dir="ltr" className="mt-3 text-start font-mono text-xl font-black">
          {code.code}
        </h1>
      </div>

      <DiscountForm
        usedCount={code.usedCount}
        initial={{
          id: code.id,
          code: code.code,
          type: code.type,
          value: String(code.value),
          minOrderAmount: String(code.minOrderAmount),
          maxDiscountAmount: String(code.maxDiscountAmount),
          usageLimit: String(code.usageLimit),
          perUserLimit: String(code.perUserLimit),
          startsAt: toLocalInput(code.startsAt),
          expiresAt: toLocalInput(code.expiresAt),
          isActive: code.isActive,
          description: code.description ?? "",
        }}
      />

      {/* سابقه‌ی استفاده */}
      <section className="max-w-2xl rounded-card border border-ink-800 bg-ink-900 p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-bold">
          آخرین استفاده‌ها ({formatNumber(code.usedCount)} بار)
        </h2>

        {code.redemptions.length === 0 ? (
          <p className="text-sm text-muted">
            هنوز کسی از این کد استفاده نکرده است.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {code.redemptions.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-800 pb-3 text-sm last:border-0 last:pb-0"
              >
                <div>
                  <Link
                    href={`/admin/orders/${r.order.id}`}
                    className="font-bold hover:text-accent-400"
                  >
                    {r.order.orderNumber}
                  </Link>
                  <p className="mt-1 text-xs text-muted">
                    {r.user.name || "بدون نام"} —{" "}
                    <span dir="ltr">{r.user.phone}</span>
                  </p>
                </div>
                <div className="text-end">
                  <p className="text-accent-400">− {formatToman(r.amount)}</p>
                  <p className="mt-1 text-[11px] text-muted">
                    {formatDateTime(r.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
