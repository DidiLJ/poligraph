export default function HomeLoading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-8 animate-pulse">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="h-8 w-56 bg-muted rounded" />
          <div className="h-4 w-40 bg-muted rounded mt-2" />
        </div>
        <div className="h-10 w-full sm:w-60 bg-muted rounded-lg" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-muted rounded-lg border-l-4 border-muted" />
        ))}
      </div>

      <div>
        <div className="h-6 w-32 bg-muted rounded mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-lg" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-3">
          <div className="h-6 w-36 bg-muted rounded" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted rounded-lg" />
          ))}
        </div>
        <div>
          <div className="h-6 w-28 bg-muted rounded mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
