import { ORDER_STATUS_LABELS, type OrderStatusKey } from "@/lib/constants";
import { cn } from "@/lib/cn";

const styles: Record<OrderStatusKey, string> = {
  PENDING_PAYMENT: "border-warning/40 bg-warning/10 text-warning",
  PAID: "border-accent-400/40 bg-accent-400/10 text-accent-400",
  DELIVERED: "border-success/40 bg-success/10 text-success",
  FAILED: "border-danger/40 bg-danger/10 text-danger",
  CANCELLED: "border-ink-600 bg-ink-800 text-muted",
};

export function OrderStatusBadge({
  status,
  className,
}: {
  status: OrderStatusKey;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-lg border px-2.5 py-1 text-xs font-bold",
        styles[status],
        className
      )}
    >
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}
