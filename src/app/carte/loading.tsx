import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <Skeleton className="h-9 w-56 mb-1" />
        <Skeleton className="h-5 w-72" />
      </div>

      <Skeleton className="h-[500px] rounded-lg" />
    </div>
  );
}
