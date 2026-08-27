"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("خطای صفحه:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 p-6">
      <div className="w-full max-w-md text-center">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-danger/15 text-3xl">
          ⚠️
        </span>

        <h1 className="mt-6 text-xl font-black">مشکلی پیش آمد</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          صفحه به‌درستی بارگذاری نشد. معمولاً با یک بار تلاش دوباره حل می‌شود.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button onClick={reset}>تلاش دوباره</Button>
          <ButtonLink href="/" variant="secondary">
            صفحه اصلی
          </ButtonLink>
        </div>

        {error.digest && (
          <p className="mt-8 text-[11px] text-muted">
            کد خطا برای پشتیبانی:{" "}
            <span dir="ltr" className="font-mono">
              {error.digest}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
