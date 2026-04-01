import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto px-4 pt-4 pb-8">
      <Skeleton className="h-4 w-64 mb-6" />

      <div className="mb-8">
        <Skeleton className="h-5 w-48 mb-2" />
        <Skeleton className="h-8 w-full max-w-2xl mb-4" />
        <div className="flex gap-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
        </div>
      </div>

      <Skeleton className="h-48 rounded-lg mb-8" />
      <Skeleton className="h-32 rounded-lg mb-8" />
      <Skeleton className="h-40 rounded-lg" />
    </div>
  );
}
