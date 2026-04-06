export default function Loading() {
  return (
    <main className="min-h-screen bg-canvas px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="panel h-40 animate-pulse rounded-[32px]" />
        <div className="grid gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={`loading-card-${index}`} className="panel h-64 animate-pulse rounded-[32px]" />
          ))}
        </div>
      </div>
    </main>
  );
}
