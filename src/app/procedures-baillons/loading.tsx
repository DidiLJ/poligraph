export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-12 animate-pulse">
        <div className="h-9 w-72 bg-muted rounded mb-4" />
        <div className="h-24 bg-muted rounded" />
      </div>
      <div className="mb-12 animate-pulse">
        <div className="h-7 w-48 bg-muted rounded mb-4" />
        <div className="h-32 bg-muted rounded" />
      </div>
      <div className="space-y-3 animate-pulse">
        <div className="h-7 w-48 bg-muted rounded mb-4" />
        <div className="h-20 bg-muted rounded" />
        <div className="h-20 bg-muted rounded" />
        <div className="h-20 bg-muted rounded" />
      </div>
    </div>
  );
}
