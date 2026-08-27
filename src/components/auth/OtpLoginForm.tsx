"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { signInWithOtp } from "@/app/actions/auth";
import { formatNumber, toLatinDigits } from "@/lib/format";
import { normalizePhone } from "@/lib/validation";

type Step = "phone" | "code";

type RequestResponse = {
  ok: boolean;
  error?: string;
  phone?: string;
  expiresInSeconds?: number;
  resendAfterSeconds?: number;
  devCode?: string;
};

export function OtpLoginForm({
  onSuccess,
  redirectTo,
}: {
  /** اگر داده شود، به‌جای رفتن به صفحه‌ی دیگر این تابع صدا زده می‌شود */
  onSuccess?: () => void;
  redirectTo?: string;
}) {
  const router = useRouter();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // فیلد تله‌ی ضدبات — کاربر واقعی هرگز نمی‌بیندش و پرش نمی‌کند
  const [website, setWebsite] = useState("");

  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus();
  }, [step]);

  // شمارش معکوس ارسال مجدد
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = window.setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearInterval(t);
  }, [secondsLeft]);

  async function requestCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);

    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError("شماره موبایل معتبر نیست. مثال: ۰۹۱۲۱۲۳۴۵۶۷");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/otp/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized, website }),
      });
      const data: RequestResponse = await res.json();

      if (!data.ok) {
        setError(data.error ?? "ارسال کد ناموفق بود.");
        return;
      }

      setPhone(normalized);
      setDevCode(data.devCode ?? null);
      setSecondsLeft(data.resendAfterSeconds ?? 60);
      setCode("");
      setStep("code");
    } catch {
      setError("ارتباط با سرور برقرار نشد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  async function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (code.length !== 6) {
      setError("کد تایید باید ۶ رقم باشد.");
      return;
    }

    setBusy(true);
    try {
      const result = await signInWithOtp(phone, code, redirectTo);
      if (!result.ok) {
        setError(result.error ?? "ورود ناموفق بود.");
        return;
      }

      if (onSuccess) onSuccess();
      else router.push(redirectTo ?? "/account");
      router.refresh();
    } catch {
      setError("خطایی رخ داد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {step === "phone" ? (
        <form onSubmit={requestCode} className="flex flex-col gap-5">
          <div>
            <label
              htmlFor="phone"
              className="mb-2 block text-sm font-bold text-fg"
            >
              شماره موبایل
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(toLatinDigits(e.target.value))}
              placeholder="09121234567"
              className="h-13 w-full rounded-xl border border-ink-700 bg-ink-900 px-4 text-center text-base tracking-widest text-fg placeholder:text-muted/60 hover:border-ink-600"
            />
            <p className="mt-2 text-xs text-muted">
              کد تایید ۶ رقمی به این شماره پیامک می‌شود.
            </p>
          </div>

          {/* تله‌ی ضدبات: از دید کاربر پنهان است، ولی بات‌ها پرش می‌کنند */}
          <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="website">وب‌سایت</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>

          {error && <ErrorBox message={error} />}

          <Button type="submit" size="lg" disabled={busy}>
            {busy ? "در حال ارسال…" : "دریافت کد تایید"}
          </Button>
        </form>
      ) : (
        <form onSubmit={submitCode} className="flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              کد ارسال‌شده به{" "}
              <span dir="ltr" className="font-bold text-fg">
                {phone}
              </span>{" "}
              را وارد کنید
            </p>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setError(null);
                setDevCode(null);
              }}
              className="flex shrink-0 items-center gap-1 text-xs text-accent-400 hover:underline"
            >
              <ChevronLeftIcon width={14} height={14} />
              تغییر شماره
            </button>
          </div>

          {devCode && (
            <div className="rounded-xl border border-brand-500/40 bg-brand-500/10 px-4 py-3 text-sm">
              <p className="text-xs text-muted">
                پنل پیامک هنوز وصل نیست، پس کد اینجا نمایش داده می‌شود:
              </p>
              <p
                dir="ltr"
                className="mt-1.5 text-center text-xl font-black tracking-[0.4em] text-brand-400"
              >
                {devCode}
              </p>
            </div>
          )}

          <div>
            <label htmlFor="code" className="mb-2 block text-sm font-bold">
              کد تایید
            </label>
            <input
              id="code"
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              dir="ltr"
              value={code}
              onChange={(e) =>
                setCode(toLatinDigits(e.target.value).replace(/\D/g, "").slice(0, 6))
              }
              placeholder="------"
              className="h-14 w-full rounded-xl border border-ink-700 bg-ink-900 px-4 text-center text-2xl font-black tracking-[0.5em] text-fg placeholder:tracking-[0.3em] placeholder:text-muted/40 hover:border-ink-600"
            />
          </div>

          {error && <ErrorBox message={error} />}

          <Button type="submit" size="lg" disabled={busy || code.length !== 6}>
            {busy ? "در حال بررسی…" : "تایید و ورود"}
          </Button>

          <button
            type="button"
            onClick={() => requestCode()}
            disabled={secondsLeft > 0 || busy}
            className="text-center text-sm text-muted transition-colors hover:text-accent-400 disabled:cursor-not-allowed disabled:hover:text-muted"
          >
            {secondsLeft > 0
              ? `ارسال مجدد کد تا ${formatNumber(secondsLeft)} ثانیه دیگر`
              : "ارسال مجدد کد"}
          </button>
        </form>
      )}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm leading-6 text-danger"
    >
      {message}
    </p>
  );
}
