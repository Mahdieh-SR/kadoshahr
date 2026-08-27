import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { DemoBanner } from "@/components/site/DemoBanner";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <DemoBanner />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
