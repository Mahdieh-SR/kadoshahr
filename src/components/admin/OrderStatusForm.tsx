"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateOrderStatus } from "@/app/actions/admin";
import { Button } from "@/components/ui/Button";
import { ChevronDownIcon } from "@/components/ui/icons";
import { ORDER_STATUS_LABELS, type OrderStatusKey } from "@/lib/constants";

const options: OrderStatusKey[] = [
  "PENDING_PAYMENT",
  "PAID",
  "DELIVERED",
  "FAILED",
  "CANCELLED",
];

export function OrderStatusForm({
  orderId,
  currentStatus,
  currentNote,
}: {
  orderId: string;
  currentStatus: OrderStatusKey;
  currentNote: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatusKey>(currentStatus);
  const [note, setNote] = useState(currentNote);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = status !== currentStatus || note !== currentNote;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    setError(null);

    try {
      const result = await updateOrderStatus({ orderId, status, deliveryNote: note });
      if (result.ok) {
        setMessage(result.message ?? "ذخیره شد.");
        router.refresh();
      } else {
        setError(result.error ?? "ذخیره نشد.");
      }
    } catch {
      setError("خطایی رخ داد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      <div>
        <label htmlFor="status" className="mb-2 block text-sm font-bold">
          وضعیت سفارش
        </label>
        <span className="relative block">
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value as OrderStatusKey)}
            className="h-12 w-full appearance-none rounded-xl border border-ink-700 bg-ink-950 ps-4 pe-10 text-sm text-fg hover:border-ink-600"
          >
            {options.map((o) => (
              <option key={o} value={o} className="bg-ink-900">
                {ORDER_STATUS_LABELS[o]}
              </option>
            ))}
          </select>
          <ChevronDownIcon
            width={18}
            height={18}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
        </span>
      </div>

      <div>
        <label htmlFor="note" className="mb-2 block text-sm font-bold">
          یادداشت تحویل
        </label>
        <textarea
          id="note"
          rows={5}
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={"کد گیفت‌کارت، کد رهگیری پستی یا هر توضیحی برای مشتری…"}
          className="w-full resize-y rounded-xl border border-ink-700 bg-ink-950 p-4 text-sm leading-7 text-fg placeholder:text-muted/60 hover:border-ink-600"
        />
        <p className="mt-2 text-xs leading-6 text-muted">
          این متن در صفحه‌ی سفارش برای مشتری نمایش داده می‌شود — ولی فقط وقتی
          وضعیت «پرداخت‌شده» یا «تحویل‌شده» باشد.
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {message && (
        <p
          role="status"
          className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success"
        >
          {message}
        </p>
      )}

      <Button type="submit" disabled={busy || !dirty} className="self-start">
        {busy ? "در حال ذخیره…" : "ذخیره تغییرات"}
      </Button>
    </form>
  );
}
