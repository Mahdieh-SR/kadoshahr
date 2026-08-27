import type { Metadata } from "next";
import {
  ProductListing,
  type ListingSearchParams,
} from "@/components/product/ProductListing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "همه محصولات",
  description: "فهرست کامل گیفت‌کارت‌ها و اکانت‌های دیجیتال با قیمت روز.",
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<ListingSearchParams>;
}) {
  const params = await searchParams;

  return (
    <ProductListing
      title="همه محصولات"
      description="با فیلتر پلتفرم، ریجن و بازه قیمت، دقیقاً همان چیزی را که می‌خواهید پیدا کنید."
      searchParams={params}
    />
  );
}
