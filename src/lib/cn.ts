/** ترکیب کلاس‌های Tailwind با نادیده گرفتن مقادیر خالی */
export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}
