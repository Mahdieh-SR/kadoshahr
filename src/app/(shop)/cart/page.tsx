import type { Metadata } from "next";
import { auth } from "@/auth";
import { CartView } from "@/components/cart/CartView";

export const metadata: Metadata = {
  title: "سبد خرید",
};

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const session = await auth();

  return (
    <div className="container-page py-12">
      <h1 className="text-2xl font-black sm:text-3xl">سبد خرید</h1>
      <div className="mt-8">
        <CartView isLoggedIn={Boolean(session?.user?.id)} />
      </div>
    </div>
  );
}
