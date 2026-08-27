import { cn } from "@/lib/cn";

/** نمایش امتیاز به‌صورت ستاره — فقط خواندنی */
export function Stars({
  rating,
  size = 16,
  className,
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      role="img"
      aria-label={`امتیاز ${rating} از ۵`}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} filled={i <= Math.round(rating)} size={size} />
      ))}
    </span>
  );
}

export function Star({ filled, size = 16 }: { filled: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinejoin="round"
      className={filled ? "text-warning" : "text-ink-600"}
      aria-hidden="true"
    >
      <path d="m12 3 2.7 5.5 6 .9-4.35 4.24 1.03 6-5.38-2.83L6.62 19.6l1.03-6L3.3 9.4l6-.9z" />
    </svg>
  );
}
