import type { Metadata } from "next";
import Link from "next/link";
import { contact, emailHref } from "@/lib/contact";
import { HeadsetIcon, BoltIcon, MailIcon } from "@/components/ui/icons";
import { CopyButton } from "@/components/site/CopyButton";

export const metadata: Metadata = {
  title: "تماس با ما",
  description:
    "راه‌های ارتباط با پشتیبانی کادوشهر — تلگرام، ایمیل و تلفن. پیش از خرید یا بعد از آن، پاسخ را از یک آدم می‌گیرید.",
  alternates: { canonical: "/contact" },
};

/**
 * کارت هر راه ارتباطی.
 *
 * `dir="ltr"` روی خود مقدار لازم است: شماره تلفن و ایمیل و آیدی، متن لاتین
 * هستند و داخل صفحه‌ی راست‌به‌چپ به‌هم می‌ریزند — مثلاً «۰۹۳۳…» با علامت‌ها
 * جابه‌جا نمایش داده می‌شود.
 */
function Channel({
  href,
  label,
  value,
  hint,
  icon,
  external = false,
  copyable = false,
}: {
  href: string;
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
  external?: boolean;
  /**
   * دکمه‌ی کپی کنار مقدار.
   *
   * برای ایمیل و تلفن لازم است: `mailto:` روی دسکتاپی که کلاینت ایمیل تنظیم
   * نشده هیچ کاری نمی‌کند و `tel:` هم فقط روی موبایل معنی دارد. کاربر کلیک
   * می‌کند، هیچ اتفاقی نمی‌افتد، و فکر می‌کند سایت خراب است.
   */
  copyable?: boolean;
}) {
  return (
    <div className="rounded-card border border-ink-800 bg-ink-900 p-6 transition-colors hover:border-ink-600">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-400/10 text-accent-400">
          {icon}
        </span>

        <div className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-fg">{label}</span>

          <div className="mt-1.5 flex items-center gap-2">
            <a
              href={href}
              {...(external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              dir="ltr"
              className="min-w-0 flex-1 truncate text-start font-mono text-sm text-accent-400 hover:underline"
            >
              {value}
            </a>
            {copyable && <CopyButton value={value} label={label} />}
          </div>

          <span className="mt-2 block text-xs leading-6 text-muted">{hint}</span>
        </div>
      </div>
    </div>
  );
}

export default function ContactPage() {
  return (
    <div className="container-page py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <header className="text-center">
          <h1 className="text-2xl font-black sm:text-3xl">تماس با ما</h1>
          <span className="mx-auto mt-5 block h-px w-16 bg-ink-700" />
          <p className="mx-auto mt-8 max-w-xl text-sm leading-8 text-muted">
            پیش از خرید سوالی دارید یا بعد از آن به مشکلی خورده‌اید؟ از هر کدام
            از راه‌های زیر پیام بدهید. سریع‌ترین راه، تلگرام است.
          </p>
        </header>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Channel
              href={contact.telegramUrl}
              external
              label="تلگرام — سریع‌ترین راه"
              value={`@${contact.telegram}`}
              hint="پیام بدهید، معمولاً در کوتاه‌ترین زمان پاسخ می‌گیرید."
              icon={<BoltIcon width={20} height={20} />}
            />
          </div>

          <Channel
            href={contact.phoneHref}
            label="تلفن"
            value={contact.phone}
            hint="روی موبایل مستقیم تماس می‌گیرد. اگر پاسخ داده نشد، در تلگرام پیام بگذارید."
            icon={<HeadsetIcon width={20} height={20} />}
            copyable
          />

          <Channel
            href={emailHref}
            label="ایمیل"
            value={contact.email}
            hint="اگر کلیک روی آدرس کاری نکرد، با دکمه‌ی کپی برش دارید و در ایمیلتان بچسبانید."
            icon={<MailIcon width={20} height={20} />}
            copyable
          />
        </div>

        {/*
          نشانی و نام ثبتی عمداً کارت کلیک‌شونده نیستند — برخلاف تلفن و ایمیل
          و تلگرام، جایی برای رفتن ندارند و لینک کردنشان کاربر را گمراه می‌کند.
        */}
        <dl className="mt-4 rounded-card border border-ink-800 bg-ink-950 p-6 text-sm leading-8">
          <div className="flex flex-wrap gap-x-2">
            <dt className="font-bold text-fg">نام ثبتی:</dt>
            <dd className="text-muted">{contact.legalName}</dd>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-2">
            <dt className="font-bold text-fg">نشانی:</dt>
            <dd className="text-muted">{contact.address}</dd>
          </div>
        </dl>

        <p className="mt-10 text-center text-xs leading-7 text-muted">
          برای پیگیری سفارش، شماره‌ی سفارش را همراه پیامتان بفرستید تا سریع‌تر
          بررسی شود. سفارش‌هایتان در{" "}
          <Link href="/account/orders" className="text-accent-400 hover:underline">
            سفارش‌های من
          </Link>{" "}
          قابل مشاهده است.
        </p>
      </div>
    </div>
  );
}
