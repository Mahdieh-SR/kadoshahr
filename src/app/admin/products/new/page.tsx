import Link from "next/link";
import { ProductForm, emptyVariant } from "@/components/admin/ProductForm";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";

export default async function NewProductPage() {
  await requireAdmin();

  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/products"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
        >
          <ChevronLeftIcon width={14} height={14} />
          بازگشت به فهرست محصولات
        </Link>
        <h1 className="mt-3 text-xl font-black">محصول جدید</h1>
      </div>

      <ProductForm
        categories={categories}
        initial={{
          title: "",
          slug: "",
          description: "",
          categoryId: categories[0]?.id ?? "",
          images: [""],
          isActive: true,
          isFeatured: false,
          specs: [{ key: "زمان تحویل", value: "" }],
          variants: [{ ...emptyVariant }],
        }}
      />
    </div>
  );
}
