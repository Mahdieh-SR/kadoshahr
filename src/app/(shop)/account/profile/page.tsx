import type { Metadata } from "next";
import { ProfileForm } from "@/components/account/ProfileForm";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "اطلاعات حساب" };

export default async function ProfilePage() {
  const sessionUser = await requireUser("/account/profile");

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      phone: true,
      name: true,
      email: true,
      province: true,
      city: true,
      address: true,
      postalCode: true,
    },
  });

  return (
    <div className="max-w-lg rounded-card border border-ink-800 bg-ink-900 p-6 sm:p-8">
      <h2 className="text-lg font-bold">اطلاعات حساب</h2>
      <p className="mt-2 text-sm text-muted">
        این اطلاعات هنگام ثبت سفارش به‌صورت پیش‌فرض پر می‌شود.
      </p>

      <div className="mt-7">
        <ProfileForm
          phone={user?.phone ?? sessionUser.phone}
          name={user?.name ?? ""}
          email={user?.email ?? ""}
          address={{
            province: user?.province ?? "",
            city: user?.city ?? "",
            address: user?.address ?? "",
            postalCode: user?.postalCode ?? "",
          }}
        />
      </div>
    </div>
  );
}
