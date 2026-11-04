// Shown the instant you navigate, while the server renders the page, so taps
// feel immediate (most noticeable on phones).
export default function Loading() {
  const bar = "animate-pulse rounded-full bg-surface-2";
  return (
    <div className="mx-auto max-w-6xl space-y-6" aria-busy aria-label="Loading">
      <div className="flex items-center gap-3">
        <div className="size-12 animate-pulse rounded-full bg-surface-2" />
        <div className={`h-8 w-44 ${bar}`} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card space-y-3">
            <div className={`h-4 w-1/3 ${bar}`} />
            <div className={`h-3 w-5/6 ${bar}`} />
            <div className={`h-3 w-2/3 ${bar}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
