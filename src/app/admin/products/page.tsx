import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { PlusIcon } from "@/components/ui/icons";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/session";
import { formatNumber, formatToman } from "@/lib/format";

export default async function AdminProductsPage() {
  await requireAdmin();

  const products = await prisma.product.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      images: true,
      isActive: true,
      isFeatured: true,
      soldCount: true,
      category: { select: { name: true } },
      variants: {
        select: { price: true, stock: true, isActive: true },
      },
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black">محصولات</h1>
          <p className="mt-2 text-sm text-muted">
            {formatNumber(products.length)} محصول ثبت شده است.
          </p>
        </div>

        <ButtonLink href="/admin/products/new">
          <PlusIcon width={18} height={18} />
          محصول جدید
        </ButtonLink>
      </div>

      {products.length === 0 ? (
        <p className="rounded-card border border-dashed border-ink-700 p-12 text-center text-sm text-muted">
          هنوز محصولی ثبت نشده است.
        </p>
      ) : (
        <ul className="grid gap-3">
          {products.map((product) => {
            const active = product.variants.filter((v) => v.isActive);
            const totalStock = active.reduce((sum, v) => sum + v.stock, 0);
            const prices = active.map((v) => v.price);
            const min = prices.length ? Math.min(...prices) : 0;

            return (
              <li key={product.id}>
                <Link
                  href={`/admin/products/${product.id}`}
                  className="flex flex-wrap items-center gap-4 rounded-card border border-ink-800 bg-ink-900 p-4 transition-colors hover:border-ink-600"
                >
                  <span className="h-14 w-16 shrink-0 overflow-hidden rounded-lg bg-ink-800">
                    {product.images[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.images[0]}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-bold">{product.title}</span>
                      {!product.isActive && (
                        <span className="rounded-md border border-ink-600 px-1.5 py-0.5 text-[10px] text-muted">
                          غیرفعال
                        </span>
                      )}
                      {product.isFeatured && (
                        <span className="rounded-md border border-brand-500/50 px-1.5 py-0.5 text-[10px] text-brand-400">
                          ویژه
                        </span>
                      )}
                      {totalStock === 0 && (
                        <span className="rounded-md border border-danger/40 px-1.5 py-0.5 text-[10px] text-danger">
                          ناموجود
                        </span>
                      )}
                    </span>
                    <span className="mt-1.5 block text-xs text-muted">
                      {product.category.name} — {formatNumber(active.length)} نسخه
                      — موجودی کل: {formatNumber(totalStock)}
                    </span>
                  </span>

                  <span className="shrink-0 text-end">
                    <span className="block text-[11px] text-muted">از</span>
                    <span className="block text-sm font-bold">
                      {formatToman(min)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
