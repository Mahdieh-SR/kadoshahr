const faNumber = new Intl.NumberFormat("fa-IR");
const faDateTime = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "medium",
  timeStyle: "short",
});
const faDate = new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" });

/** ۱۲۵۰۰۰ → «۱۲۵٬۰۰۰ تومان» */
export function formatToman(amount: number): string {
  return `${faNumber.format(amount)} تومان`;
}

/** فقط عدد، بدون واحد */
export function formatNumber(value: number): string {
  return faNumber.format(value);
}

export function formatDateTime(value: Date | string): string {
  return faDateTime.format(new Date(value));
}

export function formatDate(value: Date | string): string {
  return faDate.format(new Date(value));
}

/** درصد تخفیف را از روی قیمت قبل و بعد حساب می‌کند. اگر تخفیفی نباشد، null برمی‌گرداند. */
export function discountPercent(
  price: number,
  compareAtPrice: number | null | undefined
): number | null {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

/**
 * ارقام فارسی/عربی را به لاتین تبدیل می‌کند تا ورودی کاربر (مثلاً شماره موبایل
 * که با کیبورد فارسی تایپ شده) درست اعتبارسنجی شود.
 */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}
