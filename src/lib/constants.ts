/** حداکثر تعداد مجاز از هر کالا در یک سفارش */
export const MAX_QTY_PER_ITEM = 10;

/** حداکثر تعداد ردیف‌های مختلف در سبد */
export const MAX_CART_LINES = 20;

/** برچسب فارسی وضعیت‌های سفارش */
export const ORDER_STATUS_LABELS = {
  PENDING_PAYMENT: "در انتظار پرداخت",
  PAID: "پرداخت‌شده",
  DELIVERED: "تحویل‌شده",
  FAILED: "پرداخت ناموفق",
  CANCELLED: "لغو شده",
} as const;

export type OrderStatusKey = keyof typeof ORDER_STATUS_LABELS;
