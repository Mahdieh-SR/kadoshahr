import type { Metadata } from "next";
import Link from "next/link";
import { contact } from "@/lib/contact";

export const metadata: Metadata = {
  title: "درباره ما",
  description:
    "کادوشهر؛ خرید گیفت‌کارت و اشتراک سرویس‌های دیجیتال با قیمت شفاف، تحویل سریع و پشتیبانی انسانی.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="container-page py-16 sm:py-24">
      <article className="mx-auto max-w-3xl">
        <header className="text-center">
          <h1 className="text-2xl font-black sm:text-3xl">درباره ما</h1>
          <span className="mx-auto mt-5 block h-px w-16 bg-ink-700" />
        </header>

        <div className="mt-12 space-y-6 text-sm leading-9 text-muted sm:text-base sm:leading-10">
          <p>
            <strong className="font-bold text-fg">
              تیم کادوشهر با یک هدف ساده شروع کرد:
            </strong>{" "}
            اینکه خرید اشتراک و گیفت‌کارت‌های بین‌المللی برای کاربر ایرانی
            پیچیده نباشد. سرویس‌هایی که دنیا از آن‌ها استفاده می‌کند، اینجا با
            قیمت شفاف و بدون واسطه‌های اضافه در دسترس شماست.
          </p>

          <p>
            کار ما با اشتراک‌های اپل آغاز شد و امروز مجموعه‌ی کاملی از سرویس‌های
            این شرکت را پوشش می‌دهیم — از{" "}
            <Link href="/product/apple-music" className="text-accent-400 hover:underline">
              اپل موزیک
            </Link>
            ، اپل تی‌وی پلاس، اپل آرکید، اپل نیوز پلاس و فضای آیکلود گرفته تا
            باندل{" "}
            <Link href="/product/apple-one" className="text-accent-400 hover:underline">
              اپل وان
            </Link>
            . به‌تدریج سرویس‌های پرطرفدار دیگری هم اضافه شدند: نتفلیکس، اسپاتیفای،
            یوتیوب پریمیوم، پلی‌استیشن پلاس، ایکس‌باکس گیم پس، کانوا و تلگرام
            پریمیوم. در کنارشان گیفت‌کارت‌های استیم، آمازون، نینتندو و پلی‌استیشن
            هم موجود است.
          </p>

          <p>
            اشتراک‌ها روی{" "}
            <strong className="font-bold text-fg">اکانت شخصی خودتان</strong>{" "}
            فعال می‌شوند، نه روی اکانت اشتراکی. یعنی چیزی از دست نمی‌دهید، لازم
            نیست حساب عوض کنید و رمزتان هم دست کسی نمی‌افتد.
          </p>

          <p>
            سه چیز برای ما اصل است:{" "}
            <strong className="font-bold text-fg">قیمت شفاف</strong> — عددی که
            روی صفحه‌ی محصول می‌بینید همان است که پرداخت می‌کنید و هیچ هزینه‌ی
            پنهانی در مرحله‌ی آخر اضافه نمی‌شود؛{" "}
            <strong className="font-bold text-fg">تحویل سریع</strong> — سفارش
            بلافاصله پس از تایید پرداخت در صف انجام قرار می‌گیرد؛ و{" "}
            <strong className="font-bold text-fg">پشتیبانی انسانی</strong> — پاسخ
            را از یک آدم می‌گیرید، نه از یک ربات.
          </p>

          <p>
            اگر پیش از خرید سوالی دارید یا بعد از آن به مشکلی خوردید، همیشه در
            دسترسیم.{" "}
            <Link href="/contact" className="text-accent-400 hover:underline">
              راه‌های ارتباط با ما
            </Link>{" "}
            را ببینید. از اینکه ما را برای خریدتان انتخاب کرده‌اید سپاسگزاریم.
          </p>
        </div>

        <footer className="mt-14 rounded-card border border-ink-800 bg-ink-950 p-6 text-sm leading-8">
          <p className="text-muted">
            کادوشهر با نام ثبتی{" "}
            <strong className="font-bold text-fg">{contact.legalName}</strong>{" "}
            فعالیت می‌کند.
          </p>
          <p className="mt-2 text-muted">
            نشانی: <span className="text-fg">{contact.address}</span>
          </p>
        </footer>
      </article>
    </div>
  );
}
