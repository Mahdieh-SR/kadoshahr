"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/ui/icons";

/**
 * دکمه‌ی «کپی» برای اطلاعات تماس.
 *
 * ⚠️ چرا فقط به `navigator.clipboard` تکیه نمی‌کنیم؟
 * آن API فقط در «بستر امن» کار می‌کند — یعنی HTTPS معتبر یا localhost. روی
 * `http://` ساده اصلاً وجود ندارد و کد بدون هیچ خطای قابل‌دیدنی از کار
 * می‌افتد. روش قدیمی `execCommand` زشت است ولی همه‌جا کار می‌کند، پس
 * به‌عنوان پشتیبان می‌ماند.
 */
async function copy(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // می‌افتد روی روش پشتیبان
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    // خارج از دید، ولی باید در DOM باشد تا انتخاب شدنی باشد
    area.style.position = "fixed";
    area.style.top = "-1000px";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");

  return (
    <button
      type="button"
      aria-label={`کپی ${label}`}
      onClick={async () => {
        const ok = await copy(value);
        setState(ok ? "done" : "failed");
        setTimeout(() => setState("idle"), 2000);
      }}
      className="shrink-0 rounded-lg border border-ink-700 px-3 py-1.5 text-[11px] text-muted transition-colors hover:border-accent-400 hover:text-accent-400"
    >
      {state === "done" ? (
        <span className="flex items-center gap-1 text-accent-400">
          <CheckIcon width={13} height={13} />
          کپی شد
        </span>
      ) : state === "failed" ? (
        "دستی کپی کنید"
      ) : (
        "کپی"
      )}
    </button>
  );
}
