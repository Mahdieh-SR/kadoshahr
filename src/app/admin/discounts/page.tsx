import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/icons";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatDate, formatNumber, formatToman } from "@/lib/format";

export default async function AdminDiscountsPage() {
  await requireAdmin();

  const codes = await prisma.discountCode.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
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
    },
  });

  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black">کدهای تخفیف</h1>
          <p className="mt-2 text-sm text-muted">
            {formatNumber(codes.length)} کد ثبت شده است.
          </p>
        </div>

        <ButtonLink href="/admin/discounts/new">
          <PlusIcon width={18} height={18} />
          کد تخفیف جدید
        </ButtonLink>
      </div>

      {codes.length === 0 ? (
        <div className="rounded-card border border-dashed border-ink-700 p-12 text-center">
          <p className="text-sm text-muted">هنوز کد تخفیفی نساخته‌اید.</p>
          <p className="mt-2 text-xs text-muted">
            با دکمه‌ی بالا اولین کد را بسازید.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3">
          {codes.map((c) => {
            const expired = c.expiresAt && c.expiresAt < now;
            const notStarted = c.startsAt && c.startsAt > now;
            const exhausted = c.usageLimit > 0 && c.usedCount >= c.usageLimit;
            const usable = c.isActive && !expired && !notStarted && !exhausted;

            return (
              <li key={c.id}>
                <Link
                  href={`/admin/discounts/${c.id}`}
                  className="flex flex-wrap items-center gap-4 rounded-card border border-ink-800 bg-ink-900 p-4 transition-colors hover:border-ink-600"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span
                        dir="ltr"
                        className="rounded-lg bg-ink-800 px-2.5 py-1 font-mono text-sm font-bold tracking-wider text-accent-400"
                      >
                        {c.code}
                      </span>

                      <span className="text-sm">
                        {c.type === "PERCENT"
                          ? `${formatNumber(c.value)}٪ تخفیف`
                          : `${formatToman(c.value)} تخفیف`}
                      </span>

                      {!usable && (
                        <span className="rounded-md border border-ink-600 px-1.5 py-0.5 text-[10px] text-muted">
                          {!c.isActive
                            ? "غیرفعال"
                            : expired
                              ? "منقضی"
                              : notStarted
                                ? "هنوز شروع نشده"
                                : "ظرفیت تمام"}
                        </span>
                      )}
                    </span>

                    <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                      {c.type === "PERCENT" && c.maxDiscountAmount > 0 && (
                        <span>سقف {formatToman(c.maxDiscountAmount)}</span>
                      )}
                      {c.minOrderAmount > 0 && (
                        <span>حداقل سبد {formatToman(c.minOrderAmount)}</span>
                      )}
                      <span>
                        استفاده: {formatNumber(c.usedCount)}
                        {c.usageLimit > 0 && ` از ${formatNumber(c.usageLimit)}`}
                      </span>
                      {c.expiresAt && <span>تا {formatDate(c.expiresAt)}</span>}
                      {c.description && <span>— {c.description}</span>}
                    </span>
                  </span>

                  <span
                    className={
                      usable
                        ? "shrink-0 text-xs font-bold text-accent-400"
                        : "shrink-0 text-xs text-muted"
                    }
                  >
                    {usable ? "فعال" : "غیرقابل استفاده"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
