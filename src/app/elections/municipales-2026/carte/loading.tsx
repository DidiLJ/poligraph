import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container mx-auto px-4 max-w-6xl py-8">
      <Skeleton className="h-5 w-48 mb-4" />
      <Skeleton className="h-9 w-64 mb-2" />
      <Skeleton className="h-5 w-96 mb-6" />
      <Skeleton className="h-[500px] w-full rounded-xl" />
    </div>
  );
}
