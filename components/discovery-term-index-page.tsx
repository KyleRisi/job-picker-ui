import Link from 'next/link';
import type { DiscoveryTerm } from '@/lib/podcast-shared';

const LABELS: Record<string, string> = {
  topics: 'Topics',
  themes: 'Themes',
  people: 'People',
  cases: 'Cases',
  events: 'Events',
  collections: 'Collections',
  series: 'Series'
};

export function DiscoveryTermIndexPage({
  routeKey,
  terms
}: {
  routeKey: string;
  terms: DiscoveryTerm[];
}) {
  const label = LABELS[routeKey] || 'Discover';

  return (
    <section className="space-y-6">
      <header>
        <p className="text-xs font-black uppercase tracking-[0.2em] text-carnival-red">{label}</p>
        <h1 className="mt-2 text-4xl font-black text-carnival-ink">{label}</h1>
        <p className="mt-2 text-carnival-ink/70">Browse active {label.toLowerCase()} hubs.</p>
      </header>

      {terms.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {terms.map((term) => (
            <article key={term.id} className="rounded-2xl border border-carnival-ink/15 bg-white p-5 shadow-card">
              <h2 className="text-xl font-black text-carnival-ink">{term.name}</h2>
              {term.description ? <p className="mt-2 line-clamp-3 text-sm text-carnival-ink/70">{term.description}</p> : null}
              <div className="mt-4">
                {term.path ? (
                  <Link href={term.path} className="text-sm font-semibold text-carnival-red underline underline-offset-2">
                    Open hub
                  </Link>
                ) : (
                  <span className="text-sm text-carnival-ink/50">Hub path unavailable</span>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-carnival-ink/15 bg-white p-5 text-carnival-ink/70">No active terms yet.</p>
      )}
    </section>
  );
}
