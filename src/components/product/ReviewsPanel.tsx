"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Star, Stars } from "./Stars";
import { Button } from "@/components/ui/Button";
import { submitReview } from "@/app/actions/review";
import { formatDate, formatNumber } from "@/lib/format";

export type ReviewItem = {
  id: string;
  rating: number;
  comment: string;
  adminReply: string | null;
  createdAt: string;
  authorName: string;
};

export function ReviewsPanel({
  productId,
  reviews,
  average,
  canReview,
  eligibilityReason,
  isLoggedIn,
  productSlug,
}: {
  productId: string;
  reviews: ReviewItem[];
  average: number | null;
  canReview: boolean;
  eligibilityReason: string | null;
  isLoggedIn: boolean;
  productSlug: string;
}) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const result = await submitReview({ productId, rating, comment });
      if (!result.ok) {
        setError(result.error ?? "ثبت نظر انجام نشد.");
        return;
      }
      setDone(result.message ?? "نظر شما ثبت شد.");
      setComment("");
      router.refresh();
    } catch {
      setError("خطایی رخ داد. دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
      {/* خلاصه‌ی امتیاز + فرم */}
      <div className="lg:w-80 lg:shrink-0">
        {average !== null ? (
          <div className="rounded-card border border-ink-800 bg-ink-900 p-5 text-center">
            <p className="text-3xl font-black text-fg">
              {average.toLocaleString("fa-IR")}
            </p>
            <Stars rating={average} size={18} className="mt-2 justify-center" />
            <p className="mt-2 text-xs text-muted">
              از {formatNumber(reviews.length)} نظر
            </p>
          </div>
        ) : (
          <div className="rounded-card border border-dashed border-ink-700 p-5 text-center text-sm text-muted">
            هنوز امتیازی ثبت نشده است.
          </div>
        )}

        <div className="mt-4">
          {done ? (
            <p
              role="status"
              className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm leading-6 text-success"
            >
              {done}
            </p>
          ) : canReview ? (
            <form
              onSubmit={submit}
              className="rounded-card border border-ink-800 bg-ink-900 p-5"
            >
              <h3 className="text-sm font-bold">نظر شما</h3>

              <div className="mt-4">
                <span className="mb-2 block text-xs text-muted">امتیاز</span>
                <div className="flex flex-row-reverse justify-end gap-1">
                  {[5, 4, 3, 2, 1].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRating(value)}
                      onMouseEnter={() => setHover(value)}
                      onMouseLeave={() => setHover(0)}
                      aria-label={`${value} ستاره`}
                      className="transition-transform hover:scale-110"
                    >
                      <Star filled={value <= (hover || rating)} size={26} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="comment"
                  className="mb-2 block text-xs text-muted"
                >
                  متن نظر
                </label>
                <textarea
                  id="comment"
                  rows={4}
                  maxLength={1000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="تجربه‌تان از این محصول را بنویسید…"
                  className="w-full resize-y rounded-xl border border-ink-700 bg-ink-950 p-3 text-sm leading-7 text-fg placeholder:text-muted/60 hover:border-ink-600"
                />
                <p className="mt-1 text-[11px] text-muted">
                  {formatNumber(comment.trim().length)} از ۱۰۰۰ کاراکتر
                </p>
              </div>

              {error && (
                <p
                  role="alert"
                  className="mt-3 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs leading-6 text-danger"
                >
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={busy || comment.trim().length < 10}
                className="mt-4 w-full"
              >
                {busy ? "در حال ثبت…" : "ثبت نظر"}
              </Button>

              <p className="mt-3 text-[11px] leading-5 text-muted">
                نظر شما پس از تایید مدیر نمایش داده می‌شود.
              </p>
            </form>
          ) : (
            <div className="rounded-card border border-ink-800 bg-ink-900 p-5">
              <p className="text-sm leading-7 text-muted">
                {eligibilityReason}
              </p>
              {!isLoggedIn && (
                <Link
                  href={`/login?callbackUrl=${encodeURIComponent(`/product/${productSlug}`)}`}
                  className="mt-3 inline-block text-sm font-bold text-accent-400 hover:underline"
                >
                  ورود به حساب
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* فهرست نظرها */}
      <div className="min-w-0 flex-1">
        {reviews.length === 0 ? (
          <div className="rounded-card border border-dashed border-ink-700 p-10 text-center">
            <p className="text-sm text-muted">
              هنوز نظری برای این محصول ثبت نشده است.
            </p>
            <p className="mt-2 text-xs text-muted">
              اولین نفری باشید که تجربه‌اش را می‌نویسد.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-4">
            {reviews.map((review) => (
              <li
                key={review.id}
                className="rounded-card border border-ink-800 bg-ink-900 p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="text-sm font-bold">{review.authorName}</span>
                  <Stars rating={review.rating} size={15} />
                </div>

                <p className="mt-3 text-sm leading-7 whitespace-pre-line text-muted">
                  {review.comment}
                </p>

                <span className="mt-3 block text-[11px] text-muted">
                  {formatDate(review.createdAt)}
                </span>

                {review.adminReply && (
                  <div className="mt-4 rounded-xl border-s-2 border-accent-400 bg-ink-950 p-4">
                    <span className="text-xs font-bold text-accent-400">
                      پاسخ کادوشهر
                    </span>
                    <p className="mt-2 text-sm leading-7 whitespace-pre-line text-muted">
                      {review.adminReply}
                    </p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
