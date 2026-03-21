import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto px-4 max-w-6xl py-8">
      {/* Breadcrumb */}
      <Skeleton className="h-4 w-64 mb-6" />

      {/* Hero */}
      <Skeleton className="h-10 w-80 mb-2" />
      <Skeleton className="h-5 w-96 mb-4" />
      <div className="grid grid-cols-3 gap-4 mb-8">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>

      {/* Search */}
      <Skeleton className="h-12 w-full rounded-lg mb-8" />

      {/* Chiffres */}
      <Skeleton className="h-6 w-48 mb-4" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>

      {/* Most contested */}
      <Skeleton className="h-6 w-64 mb-4" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
