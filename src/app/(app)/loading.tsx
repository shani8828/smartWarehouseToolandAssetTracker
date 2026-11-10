// Instant skeleton while a page's data loads, so navigation never feels stuck.
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="h-7 w-48 rounded-md bg-slate-100" />
      <div className="mt-2 h-4 w-72 rounded-md bg-slate-100" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-50 ring-1 ring-slate-100" />
        ))}
      </div>
      <div className="mt-6 h-72 rounded-xl bg-slate-50 ring-1 ring-slate-100" />
    </div>
  );
}
