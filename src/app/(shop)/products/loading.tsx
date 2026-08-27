import { ProductCardSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="container-page py-12">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-4 h-4 w-96 max-w-full" />

      <div className="mt-10 grid gap-10 lg:grid-cols-[260px_1fr] lg:gap-12">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>

        <div>
          <Skeleton className="h-5 w-32" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
