"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteReview, moderateReview } from "@/app/actions/admin";
import { Button } from "@/components/ui/Button";
import { Stars } from "@/components/product/Stars";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export type AdminReview = {
  id: string;
  rating: number;
  comment: string;
  adminReply: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  authorName: string;
  authorPhone: string;
  productTitle: string;
  productSlug: string;
};

const statusStyles = {
  PENDING: "border-warning/40 bg-warning/10 text-warning",
  APPROVED: "border-success/40 bg-success/10 text-success",
  REJECTED: "border-danger/40 bg-danger/10 text-danger",
} as const;

const statusLabels = {
  PENDING: "در انتظار تایید",
  APPROVED: "تاییدشده",
  REJECTED: "رد شده",
} as const;

export function ReviewCard({ review }: { review: AdminReview }) {
  const router = useRouter();
  const [reply, setReply] = useState(review.adminReply ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showReply, setShowReply] = useState(Boolean(review.adminReply));

  async function moderate(status: AdminReview["status"]) {
    setBusy(true);
    setError(null);
    try {
      const result = await moderateReview({
        reviewId: review.id,
        status,
        adminReply: reply,
      });
      if (!result.ok) setError(result.error ?? "انجام نشد.");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("این نظر برای همیشه حذف شود؟")) return;
    setBusy(true);
    try {
      const result = await deleteReview(review.id);
      if (!result.ok) setError(result.error ?? "حذف نشد.");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-card border border-ink-800 bg-ink-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/product/${review.productSlug}`}
            target="_blank"
            className="text-sm font-bold hover:text-accent-400"
          >
            {review.productTitle}
          </Link>
          <p className="mt-1 text-xs text-muted">
            {review.authorName} — <span dir="ltr">{review.authorPhone}</span> —{" "}
            {formatDateTime(review.createdAt)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <Stars rating={review.rating} size={15} />
          <span
            className={cn(
              "rounded-lg border px-2 py-0.5 text-[11px] font-bold",
              statusStyles[review.status]
            )}
          >
            {statusLabels[review.status]}
          </span>
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-ink-950 p-4 text-sm leading-7 whitespace-pre-line text-fg">
        {review.comment}
      </p>

      {showReply ? (
        <div className="mt-4">
          <label className="mb-2 block text-xs text-muted">
            پاسخ فروشگاه (اختیاری — زیر نظر مشتری نمایش داده می‌شود)
          </label>
          <textarea
            rows={3}
            maxLength={1000}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="پاسخ شما به این نظر…"
            className="w-full resize-y rounded-xl border border-ink-700 bg-ink-950 p-3 text-sm leading-7 text-fg placeholder:text-muted/60 hover:border-ink-600"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowReply(true)}
          className="mt-3 text-xs text-accent-400 hover:underline"
        >
          + افزودن پاسخ فروشگاه
        </button>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger"
        >
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-800 pt-4">
        {review.status !== "APPROVED" && (
          <Button size="sm" onClick={() => moderate("APPROVED")} disabled={busy}>
            تایید و انتشار
          </Button>
        )}

        {review.status === "APPROVED" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => moderate("APPROVED")}
            disabled={busy}
          >
            ذخیره پاسخ
          </Button>
        )}

        {review.status !== "REJECTED" && (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => moderate("REJECTED")}
            disabled={busy}
          >
            رد کردن
          </Button>
        )}

        <Button size="sm" variant="danger" onClick={remove} disabled={busy}>
          حذف
        </Button>
      </div>
    </article>
  );
}
