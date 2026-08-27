"use client";

import { useState } from "react";
import { CheckIcon } from "@/components/ui/icons";

/** کپی آدرس پستی در یک کلیک، برای چسباندن روی بسته */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // اگر مرورگر اجازه نداد، کاربر می‌تواند دستی انتخاب و کپی کند
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-accent-400 hover:text-accent-400"
    >
      {copied ? (
        <>
          <CheckIcon width={13} height={13} />
          کپی شد
        </>
      ) : (
        label
      )}
    </button>
  );
}
