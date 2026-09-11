"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { refreshSuggestedRate, saveUsdRate } from "@/app/actions/admin";
import { Button } from "@/components/ui/Button";
import { RefreshIcon } from "@/components/ui/icons";
import { formatNumber, formatDateTime, toLatinDigits } from "@/lib/format";

/** همان فرمول سرور — فقط برای پیش‌نمایش زنده. عدد نهایی را همیشه سرور می‌نویسد. */
function previewToman(
  priceUsdCents: number,
  rate: number,
  marginPercent: number,
  roundTo: number
): number {
  if (priceUsdCents <= 0 || rate <= 0) return 0;
  const step = roundTo > 0 ? Math.floor(roundTo) : 1;
  const raw = (priceUsdCents * rate * (100 + marginPercent)) / 10000;
  return Math.max(1000, Math.ceil(raw / step) * step);
}

export type RateSample = {
  id: string;
  title: string;
  label: string;
  usd: number;
  before: number;
  after: number;
};

export type UsdRateSettings = {
  usdRate: number;
  marginPercent: number;
  roundTo: number;
  suggestedRate: number | null;
  suggestedAt: string | null;
  suggestedFrom: string | null;
  appliedAt: string | null;
};

const digits = (v: string) => toLatinDigits(v).replace(/\D/g, "");

const input =
  "h-12 w-full rounded-xl border border-ink-700 bg-ink-950 px-4 text-sm text-fg placeholder:text-muted/60 hover:border-ink-600";

export function UsdRateForm({
  settings,
  usdVariantCount,
  samples,
}: {
  settings: UsdRateSettings;
  usdVariantCount: number;
  samples: RateSample[];
}) {
  const router = useRouter();

  const [rate, setRate] = useState(String(settings.usdRate || ""));
  const [margin, setMargin] = useState(String(settings.marginPercent));
  const [roundTo, setRoundTo] = useState(String(settings.roundTo));

  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // وقتی نرخ جهش بزرگی دارد، سرور بار اول رد می‌کند و منتظر تایید دوباره می‌ماند
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  const rateNumber = Number(rate || 0);
  const marginNumber = Number(margin || 0);
  const roundNumber = Number(roundTo || 1);

  const preview = useMemo(
    () =>
      samples.map((s) => ({
        ...s,
        after: previewToman(
          Math.round(s.usd * 100),
          rateNumber,
          marginNumber,
          roundNumber
        ),
      })),
    [samples, rateNumber, marginNumber, roundNumber]
  );

  const effectiveRate =
    rateNumber > 0 ? Math.round((rateNumber * (100 + marginNumber)) / 100) : 0;

  const dirty =
    rateNumber !== settings.usdRate ||
    marginNumber !== settings.marginPercent ||
    roundNumber !== settings.roundTo;

  async function getSuggested() {
    setFetching(true);
    setError(null);
    setMessage(null);
    try {
      const result = await refreshSuggestedRate();
      if (!result.ok) {
        setError(result.error ?? "نرخ روز گرفته نشد.");
        return;
      }
      setMessage(`${result.message} — ${result.note ?? ""}`);
      router.refresh();
    } catch {
      setError("ارتباط با سرویس نرخ برقرار نشد.");
    } finally {
      setFetching(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const result = await saveUsdRate({
        usdRate: rateNumber,
        marginPercent: marginNumber,
        roundTo: roundNumber,
        confirmJump: awaitingConfirm,
      });

      if (!result.ok) {
        setError(result.error ?? "ذخیره نشد.");
        setAwaitingConfirm(Boolean(result.needsConfirm));
        return;
      }

      setAwaitingConfirm(false);
      setMessage(result.message ?? "ذخیره شد.");
      router.refresh();
    } catch {
      setError("خطایی رخ داد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-3xl flex-col gap-6">
      {/* ── نرخ پیشنهادی ── */}
      <section className="rounded-card border border-ink-800 bg-ink-900 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold">نرخ روز بازار</h2>
            {settings.suggestedRate ? (
              <>
                <p className="mt-2 text-2xl font-black text-accent-400">
                  {formatNumber(settings.suggestedRate)}
                  <span className="ms-2 text-xs font-normal text-muted">تومان</span>
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  {settings.suggestedFrom} ·{" "}
                  {settings.suggestedAt
                    ? formatDateTime(settings.suggestedAt)
                    : "—"}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted">
                هنوز نرخی گرفته نشده است.
              </p>
            )}
          </div>

          <div className="flex flex-col items-stretch gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={getSuggested}
              disabled={fetching}
            >
              <RefreshIcon width={16} height={16} />
              {fetching ? "در حال گرفتن…" : "گرفتن نرخ روز"}
            </Button>

            {settings.suggestedRate ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setRate(String(settings.suggestedRate))}
              >
                گذاشتن در کادر نرخ
              </Button>
            ) : null}
          </div>
        </div>

        <p className="mt-4 rounded-xl bg-ink-950 p-3 text-[11px] leading-relaxed text-muted">
          این عدد فقط یک <b>پیشنهاد</b> است و تا وقتی شما ذخیره نکنید هیچ قیمتی
          عوض نمی‌شود. نرخ بسته‌شدن دلار بازار آزاد در آخرین روز کاری است، نه نرخ
          لحظه‌ای. نرخ فروش خودتان معمولاً کمی بالاتر است.
        </p>
      </section>

      {/* ── تنظیم نرخ ── */}
      <section className="rounded-card border border-ink-800 bg-ink-900 p-5 sm:p-6">
        <h2 className="mb-5 text-sm font-bold">نرخ فروشگاه</h2>

        <div className="grid gap-5 sm:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-sm font-bold text-fg">
              نرخ هر دلار (تومان)
            </span>
            <input
              value={rate ? formatNumber(Number(rate)) : ""}
              onChange={(e) => setRate(digits(e.target.value))}
              inputMode="numeric"
              required
              placeholder="۲۰۰٬۰۰۰"
              className={input}
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-fg">
              درصد سود
            </span>
            <input
              value={margin}
              onChange={(e) => setMargin(digits(e.target.value))}
              inputMode="numeric"
              placeholder="۰"
              className={input}
            />
            <p className="mt-2 text-[11px] text-muted">
              روی نرخ اضافه می‌شود
            </p>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-bold text-fg">
              رند کردن
            </span>
            <span className="relative block">
              <select
                value={roundTo}
                onChange={(e) => setRoundTo(e.target.value)}
                className={`${input} appearance-none ps-4 pe-10`}
              >
                <option value="1000" className="bg-ink-900">
                  هزار تومان
                </option>
                <option value="10000" className="bg-ink-900">
                  ده هزار تومان
                </option>
                <option value="5000" className="bg-ink-900">
                  پنج هزار تومان
                </option>
                <option value="1" className="bg-ink-900">
                  بدون رند
                </option>
              </select>
            </span>
            <p className="mt-2 text-[11px] text-muted">همیشه به بالا</p>
          </label>
        </div>

        {effectiveRate > 0 && (
          <p className="rounded-xl bg-ink-950 p-3 text-xs text-muted">
            هر دلار برای مشتری{" "}
            <b className="text-fg">{formatNumber(effectiveRate)} تومان</b> حساب
            می‌شود
            {marginNumber > 0
              ? ` (${formatNumber(rateNumber)} + ${marginNumber}٪ سود)`
              : ""}
            .
          </p>
        )}

        <p className="text-[11px] text-muted">
          {usdVariantCount > 0 ? (
            <>
              الان <b className="text-fg">{formatNumber(usdVariantCount)}</b>{" "}
              نسخه قیمت دلاری دارند و با ذخیره‌ی این فرم قیمتشان بازنویسی می‌شود.
            </>
          ) : (
            "هنوز هیچ محصولی قیمت دلاری ندارد. بعد از تنظیم نرخ، در فرم محصول گزینه‌ی «قیمت دلاری» را روشن کنید."
          )}
          {settings.appliedAt
            ? ` آخرین بار: ${formatDateTime(settings.appliedAt)}`
            : ""}
        </p>
      </section>

      {/* ── پیش‌نمایش ── */}
      {preview.length > 0 && (
        <section className="rounded-card border border-ink-800 bg-ink-900 p-5 sm:p-6">
          <h2 className="mb-1 text-sm font-bold">
            {dirty ? "قیمت‌ها بعد از ذخیره چه می‌شوند" : "قیمت‌های فعلی"}
          </h2>
          <p className="mb-5 text-[11px] text-muted">
            چند نمونه از گران‌ترین محصولات دلاری.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="text-start text-[11px] text-muted">
                  <th className="pb-3 text-start font-normal">محصول</th>
                  <th className="pb-3 text-start font-normal">دلار</th>
                  <th className="pb-3 text-start font-normal">الان</th>
                  <th className="pb-3 text-start font-normal">بعد از ذخیره</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((s) => {
                  const up = s.after > s.before;
                  const down = s.after < s.before;

                  return (
                    <tr key={s.id} className="border-t border-ink-800">
                      <td className="py-3 pe-3">
                        <span className="block font-bold">{s.title}</span>
                        <span className="block text-[11px] text-muted">
                          {s.label}
                        </span>
                      </td>
                      <td className="py-3 pe-3 text-muted" dir="ltr">
                        ${s.usd}
                      </td>
                      <td className="py-3 pe-3 text-muted">
                        {formatNumber(s.before)}
                      </td>
                      <td
                        className={`py-3 font-bold ${
                          up ? "text-danger" : down ? "text-accent-400" : ""
                        }`}
                      >
                        {formatNumber(s.after)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </p>
      )}

      {message && (
        <p className="rounded-xl border border-accent-400/40 bg-accent-400/10 p-4 text-sm text-accent-400">
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy || rateNumber <= 0}>
          {busy
            ? "در حال ذخیره…"
            : awaitingConfirm
              ? "بله، همین نرخ درست است"
              : "ذخیره و به‌روزرسانی قیمت‌ها"}
        </Button>
      </div>
    </form>
  );
}
