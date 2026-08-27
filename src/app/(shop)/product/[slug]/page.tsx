import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ProductGallery } from "@/components/product/ProductGallery";
import { ProductTabs } from "@/components/product/ProductTabs";
import { ProductCard } from "@/components/product/ProductCard";
import { ReviewsPanel } from "@/components/product/ReviewsPanel";
import { Stars } from "@/components/product/Stars";
import { VariantPicker } from "@/components/product/VariantPicker";
import { getProductBySlug, getRelatedProducts } from "@/lib/products";
import {
  averageRating,
  checkEligibility,
  getProductReviews,
} from "@/lib/reviews";
import { formatNumber } from "@/lib/format";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "محصول پیدا نشد" };

  const description = product.description.slice(0, 155);

  return {
    title: product.title,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: {
      title: product.title,
      description,
      type: "website",
      images: product.images[0] ? [product.images[0]] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const session = await auth();
  const userId = session?.user?.id ?? null;

  const [related, reviews, eligibility] = await Promise.all([
    getRelatedProducts(product.id, product.categoryId),
    getProductReviews(product.id),
    checkEligibility(userId, product.id),
  ]);

  const rating = averageRating(product.ratingSum, product.reviewCount);

  return (
    <div className="container-page py-10">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Link href="/" className="hover:text-fg">
          خانه
        </Link>
        <span>/</span>
        <Link href={`/category/${product.category.slug}`} className="hover:text-fg">
          {product.category.name}
        </Link>
        <span>/</span>
        <span className="text-fg">{product.title}</span>
      </nav>

      <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <ProductGallery images={product.images} title={product.title} />

        <div className="flex flex-col gap-7">
          <div>
            <h1 className="text-2xl leading-10 font-black sm:text-3xl">
              {product.title}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
              <span>{formatNumber(product.soldCount)} بار فروخته شده</span>

              {rating !== null && (
                <span className="flex items-center gap-1.5">
                  <Stars rating={rating} size={14} />
                  <span>
                    {formatNumber(rating)} از {formatNumber(product.reviewCount)}{" "}
                    نظر
                  </span>
                </span>
              )}
            </div>
          </div>

          <VariantPicker
            productSlug={product.slug}
            productTitle={product.title}
            image={product.images[0] ?? null}
            variants={product.variants}
          />
        </div>
      </div>

      <div className="mt-16">
        <ProductTabs
          description={product.description}
          specs={product.specs}
          reviewCount={product.reviewCount}
          reviewsSlot={
            <ReviewsPanel
              productId={product.id}
              productSlug={product.slug}
              isLoggedIn={Boolean(userId)}
              average={rating}
              canReview={eligibility.canReview}
              eligibilityReason={
                eligibility.canReview ? null : eligibility.reason
              }
              reviews={reviews.map((r) => ({
                ...r,
                createdAt: r.createdAt.toISOString(),
              }))}
            />
          }
        />
      </div>

      {related.length > 0 && (
        <section className="mt-16">
          <h2 className="text-xl font-bold">محصولات مشابه</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
