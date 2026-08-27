import type { Metadata } from "next";
import { auth } from "@/auth";
import { CheckoutFlow } from "@/components/checkout/CheckoutFlow";
import { prisma } from "@/lib/prisma";
import { isMockMode } from "@/lib/zarinpal";

export const metadata: Metadata = { title: "تسویه‌حساب" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await auth();

  // اگر کاربر وارد شده، نام و ایمیل قبلی‌اش را پیش‌فرض پر می‌کنیم
  const user = session?.user?.id
    ? await prisma.user.findUnique({
        where: { id: session.user.id },
        select: {
          name: true,
          email: true,
          province: true,
          city: true,
          address: true,
          postalCode: true,
        },
      })
    : null;

  const [firstName = "", ...rest] = (user?.name ?? "").split(" ");

  return (
    <div className="container-page py-12">
      <h1 className="text-2xl font-black sm:text-3xl">تسویه‌حساب</h1>
      <p className="mt-3 text-sm text-muted">
        سفارش را نهایی کنید و به درگاه پرداخت بروید.
      </p>

      <div className="mt-8">
        <CheckoutFlow
          isLoggedIn={Boolean(session?.user?.id)}
          defaultFirstName={firstName}
          defaultLastName={rest.join(" ")}
          defaultEmail={user?.email ?? ""}
          defaultAddress={{
            province: user?.province ?? "",
            city: user?.city ?? "",
            address: user?.address ?? "",
            postalCode: user?.postalCode ?? "",
          }}
          gatewayIsMock={isMockMode()}
        />
      </div>
    </div>
  );
}
