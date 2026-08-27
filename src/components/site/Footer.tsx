import Link from "next/link";

const columns = [
  {
    title: "فروشگاه",
    links: [
      { href: "/products", label: "همه محصولات" },
      { href: "/category/gaming", label: "گیفت‌کارت گیمینگ" },
      { href: "/category/subscriptions", label: "اشتراک سرویس‌ها" },
      { href: "/category/ai-tools", label: "سرویس‌های هوش مصنوعی" },
    ],
  },
  {
    title: "حساب کاربری",
    links: [
      { href: "/account", label: "پیشخوان" },
      { href: "/account/orders", label: "سفارش‌های من" },
      { href: "/cart", label: "سبد خرید" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ink-800 bg-ink-900">
      <div className="container-page grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-400 text-sm font-black text-ink-950">
              گ
            </span>
            <span className="text-lg font-bold">گیفت‌لند</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-7 text-muted">
            خرید گیفت‌کارت و اکانت دیجیتال با تحویل سریع، قیمت شفاف و پشتیبانی
            انسانی. سفارش شما بعد از تایید پرداخت پیگیری می‌شود.
          </p>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-bold">{col.title}</h3>
            <ul className="mt-4 flex flex-col gap-3">
              {col.links.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted transition-colors hover:text-fg"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-ink-800">
        <div className="container-page py-5 text-xs text-muted">
          © {new Date().getFullYear()} گیفت‌لند — تمامی حقوق محفوظ است.
        </div>
      </div>
    </footer>
  );
}
