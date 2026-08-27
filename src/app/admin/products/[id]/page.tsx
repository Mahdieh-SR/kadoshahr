import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatNumber } from "@/lib/format";

type Spec = { key: string; value: string };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        specs: true,
        images: true,
        isActive: true,
        isFeatured: true,
        soldCount: true,
        categoryId: true,
        variants: {
          orderBy: { price: "asc" },
          select: {
            id: true,
            platform: true,
            region: true,
            capacity: true,
            price: true,
            compareAtPrice: true,
            stock: true,
            isActive: true,
          },
        },
      },
    }),
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  if (!product) notFound();

  const specs: Spec[] = Array.isArray(product.specs)
    ? (product.specs as unknown as Spec[]).filter(
        (s) => s && typeof s.key === "string" && typeof s.value === "string"
      )
    : [];

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

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-black">{product.title}</h1>
          <Link
            href={`/product/${product.slug}`}
            target="_blank"
            className="text-xs text-accent-400 hover:underline"
          >
            دیدن در فروشگاه ↗
          </Link>
        </div>

        <p className="mt-2 text-sm text-muted">
          {formatNumber(product.soldCount)} بار فروخته شده
        </p>
      </div>

      <ProductForm
        categories={categories}
        initial={{
          id: product.id,
          title: product.title,
          slug: product.slug,
          description: product.description,
          categoryId: product.categoryId,
          images: product.images.length > 0 ? product.images : [""],
          isActive: product.isActive,
          isFeatured: product.isFeatured,
          specs: specs.length > 0 ? specs : [{ key: "", value: "" }],
          variants: product.variants.map((v) => ({
            id: v.id,
            platform: v.platform,
            region: v.region,
            capacity: v.capacity,
            price: String(v.price),
            compareAtPrice: v.compareAtPrice ? String(v.compareAtPrice) : "",
            stock: String(v.stock),
            isActive: v.isActive,
          })),
        }}
      />
    </div>
  );
}
