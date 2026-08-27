import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 p-6">
      <div className="w-full max-w-md text-center">
        <p className="text-6xl font-black text-brand-500">۴۰۴</p>

        <h1 className="mt-6 text-xl font-black">این صفحه پیدا نشد</h1>
        <p className="mt-3 text-sm leading-7 text-muted">
          ممکن است آدرس را اشتباه وارد کرده باشید، یا این صفحه دیگر وجود نداشته
          باشد.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <ButtonLink href="/products">دیدن محصولات</ButtonLink>
          <ButtonLink href="/" variant="secondary">
            صفحه اصلی
          </ButtonLink>
        </div>

        <p className="mt-8 text-xs text-muted">
          دنبال سفارشتان می‌گردید؟{" "}
          <Link href="/account/orders" className="text-accent-400 hover:underline">
            سفارش‌های من
          </Link>
        </p>
      </div>
    </div>
  );
}
