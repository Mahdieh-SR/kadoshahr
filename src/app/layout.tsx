import type { Metadata } from "next";
import { Vazirmatn } from "next/font/google";
import { CartProvider } from "@/components/cart/CartProvider";
import "./globals.css";

const vazirmatn = Vazirmatn({
  subsets: ["arabic"],
  display: "swap",
  variable: "--font-vazirmatn",
});

const siteUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "گیفت‌لند — خرید گیفت‌کارت و اکانت دیجیتال",
    template: "%s | گیفت‌لند",
  },
  description:
    "خرید آنی گیفت‌کارت و اکانت‌های دیجیتال با تحویل سریع و پشتیبانی واقعی.",
  keywords: [
    "گیفت کارت",
    "خرید گیفت کارت",
    "اکانت دیجیتال",
    "گیفت کارت پلی استیشن",
    "اشتراک اسپاتیفای",
  ],
  openGraph: {
    type: "website",
    locale: "fa_IR",
    siteName: "گیفت‌لند",
    title: "گیفت‌لند — خرید گیفت‌کارت و اکانت دیجیتال",
    description:
      "خرید آنی گیفت‌کارت و اکانت‌های دیجیتال با تحویل سریع و پشتیبانی واقعی.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className={vazirmatn.variable}>
      <body className="font-sans antialiased">
        <CartProvider>{children}</CartProvider>
      </body>
    </html>
  );
}
