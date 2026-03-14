export function WorkspaceSectionPlaceholder({
  title,
  description
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="space-y-3">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-600">{description}</p>
      </header>

      <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-10 text-sm text-slate-600">
        This section is scaffolded and ready for migration work.
      </div>
    </section>
  );
}
