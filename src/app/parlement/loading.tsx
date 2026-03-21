export default function ParlementLoading() {
  return (
    <div className="container mx-auto px-4 py-8 animate-pulse">
      <div className="mb-8">
        <div className="h-9 w-48 bg-muted rounded mb-2" />
        <div className="h-5 w-72 bg-muted rounded" />
      </div>
      <div className="mb-8 p-6 bg-muted/50 rounded-lg">
        <div className="h-6 w-56 bg-muted rounded mb-4" />
        <div className="flex gap-4">
          <div className="h-16 flex-1 bg-muted rounded" />
          <div className="h-16 flex-1 bg-muted rounded" />
        </div>
      </div>
      <div className="mb-8">
        <div className="h-6 w-44 bg-muted rounded mb-3" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-8 w-28 bg-muted rounded-full" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="h-48 bg-muted rounded-lg" />
        <div className="h-48 bg-muted rounded-lg" />
      </div>
      <div className="mb-8">
        <div className="h-6 w-40 bg-muted rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-40 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
