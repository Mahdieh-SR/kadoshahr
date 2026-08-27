import { cn } from "@/lib/cn";

/** بلوک خاکستری متحرک که تا آماده شدن محتوا جای آن را می‌گیرد */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-ink-800", className)}
      aria-hidden="true"
    />
  );
}

/** اسکلت کارت محصول — همان ابعاد کارت واقعی تا صفحه نپرد */
export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-card border border-ink-800 bg-ink-900">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="border-t border-ink-800 pt-3">
          <Skeleton className="h-5 w-28" />
        </div>
      </div>
    </div>
  );
}
