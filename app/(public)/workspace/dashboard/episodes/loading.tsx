export default function WorkspaceEpisodesLoading() {
  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <div className="h-7 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-72 animate-pulse rounded bg-slate-200" />
      </header>

      <div className="rounded-md border border-slate-300 bg-white p-3">
        <div className="h-10 w-full animate-pulse rounded bg-slate-100" />
      </div>

      <div className="rounded-md border border-slate-300 bg-white p-3">
        <div className="h-64 w-full animate-pulse rounded bg-slate-100" />
      </div>
    </section>
  );
}
