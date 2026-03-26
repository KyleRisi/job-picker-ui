import Link from 'next/link';
import fs from 'node:fs';
import path from 'node:path';
import type { DiscoveryTerm } from '@/lib/podcast-shared';
import { DiscoveryAnalyticsEventTracker } from '@/components/discovery-analytics-event-tracker';

const LABELS: Record<string, string> = {
  topics: 'Topics',
  themes: 'Themes',
  people: 'People',
  cases: 'Cases',
  events: 'Events',
  collections: 'Collections',
  series: 'Series'
};

const CARD_BG_FOLDER = 'topic-hub-card-backgrounds';
const CARD_BG_EXTENSIONS = ['avif', 'webp', 'png', 'jpg', 'jpeg'];
const DISPLAY_TITLE_OVERRIDES: Record<string, string> = {
  'true-crime': 'True Crime',
  history: 'History',
  'incredible-people': 'Incredible People',
  'scams-hoaxes-cons': 'Scams, Hoaxes & Cons',
  'disasters-survival': 'Disasters & Survival',
  'mysteries-unexplained': 'Mysteries',
  'cults-belief-moral-panics': 'Cults',
  'pop-culture-entertainment': 'Pop Culture'
};
const CARD_BG_SLUG_ALIASES: Record<string, string[]> = {
  'scams-hoaxes-cons': ['scams'],
  'disasters-survival': ['disasters'],
  'mysteries-unexplained': ['mysteries'],
  'cults-belief-moral-panics': ['cults'],
  'pop-culture-entertainment': ['pop-culture']
};

function resolveCardBackgroundUrl(slug: string): string | null {
  const folderPath = path.join(process.cwd(), 'public', CARD_BG_FOLDER);
  if (!fs.existsSync(folderPath)) return null;

  const files = fs.readdirSync(folderPath);
  const requestedBases = [slug, ...(CARD_BG_SLUG_ALIASES[slug] || [])].map((value) => value.toLowerCase());

  for (const requestedBase of requestedBases) {
    for (const extension of CARD_BG_EXTENSIONS) {
      const match = files.find((file) => file.toLowerCase() === `${requestedBase}.${extension}`);
      if (match) return `/${CARD_BG_FOLDER}/${match}`;
    }
  }

  const normalizedSlug = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const file of files) {
    const parts = file.split('.');
    if (parts.length < 2) continue;
    const extension = parts[parts.length - 1].toLowerCase();
    if (!CARD_BG_EXTENSIONS.includes(extension)) continue;
    const base = parts.slice(0, -1).join('.').toLowerCase();
    const normalizedBase = base.replace(/[^a-z0-9]/g, '');
    if (!normalizedBase) continue;
    if (normalizedSlug.includes(normalizedBase) || normalizedBase.includes(normalizedSlug)) {
      return `/${CARD_BG_FOLDER}/${file}`;
    }
  }

  return null;
}

export function DiscoveryTermIndexPage({
  routeKey,
  terms
}: {
  routeKey: string;
  terms: DiscoveryTerm[];
}) {
  const label = LABELS[routeKey] || 'Discover';
  const isTopicsPage = routeKey === 'topics';

  if (!isTopicsPage) {
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

  return (
    <div className="space-y-0">
      <DiscoveryAnalyticsEventTracker />
      <section className="full-bleed relative -mt-8 overflow-hidden bg-carnival-ink pb-12 pt-12 text-white md:pb-16 md:pt-16">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-24 top-12 h-80 w-80 rounded-full bg-carnival-red/30 blur-[130px]" />
          <div className="absolute left-1/3 top-0 h-96 w-[560px] -translate-x-1/2 bg-[#11163a]/70 blur-[120px]" />
          <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-carnival-gold/20 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-carnival-gold">Curated listening guide</p>
            <h1 className="mt-3 text-5xl font-black tracking-tight text-white sm:text-6xl">Topic Hubs</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/88">
              Explore The Compendium&apos;s active topic hubs and jump straight into the stories you want most.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#topic-hub-cards"
                className="inline-flex items-center rounded-full bg-carnival-red px-6 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:brightness-110"
              >
                Jump to topic hubs
              </a>
              <Link
                href="/episodes"
                className="inline-flex items-center rounded-full border border-carnival-gold/70 bg-carnival-gold/10 px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-carnival-gold transition hover:bg-carnival-gold/20"
              >
                Browse all episodes
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="topic-hub-cards" className="space-y-6 py-10 md:py-14">
        <header>
          <h2 className="mt-2 text-4xl font-black text-carnival-ink">Choose Your Hub</h2>
        </header>

        {terms.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {terms.map((term) => {
              const backgroundUrl = resolveCardBackgroundUrl(term.slug);
              const displayTitle = DISPLAY_TITLE_OVERRIDES[term.slug] || term.name;
              const cardContent = (
                <>
                  {backgroundUrl ? (
                    <div
                      aria-hidden
                      className="absolute inset-0 -z-20 bg-cover bg-center"
                      style={{ backgroundImage: `url(${backgroundUrl})` }}
                    />
                  ) : null}
                  <div className="mt-auto">
                    <h2 className="text-xl font-black text-carnival-ink">
                      <span className="inline-flex rounded-full bg-carnival-red px-3 py-1 text-xl leading-tight text-white">
                        {displayTitle}
                      </span>
                    </h2>
                    {term.description ? <p className="mt-2 line-clamp-3 text-base leading-5 text-white">{term.description}</p> : null}
                  </div>
                </>
              );

              const cardClassName =
                'group relative isolate flex min-h-[240px] flex-col overflow-hidden rounded-2xl bg-carnival-ink p-5 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-xl';

              if (term.path) {
                return (
                  <Link
                    key={term.id}
                    href={term.path}
                    className={cardClassName}
                    aria-label={`Open ${term.name} hub`}
                    data-discovery-event="topic_card_clicked"
                    data-page-path="/topics"
                    data-page-type="topics_index"
                    data-topic-slug={term.slug}
                    data-destination={term.path}
                    data-source-section="topics_grid"
                  >
                    {cardContent}
                  </Link>
                );
              }

              return (
                <article key={term.id} className={cardClassName}>
                  {cardContent}
                </article>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl border border-carnival-ink/15 bg-white p-5 text-carnival-ink/70">No active terms yet.</p>
        )}
      </section>

      <section className="full-bleed bg-carnival-gold py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <h2 className="text-2xl font-black text-carnival-ink md:text-3xl">Not sure where to start?</h2>
          <p className="mx-auto mt-2 max-w-3xl text-sm leading-relaxed text-carnival-ink/80 md:text-base">
            Start with the latest episodes or browse the full archive if you&apos;d rather explore everything.
          </p>
          <div className="mx-auto mt-5 flex w-full max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/episodes?sort=latest" className="btn-primary">
              See latest episodes
            </Link>
            <Link
              href="/episodes"
              className="inline-flex items-center justify-center rounded-md border border-carnival-ink/30 bg-transparent px-5 py-3 text-sm font-bold text-carnival-ink transition hover:bg-carnival-ink/10"
            >
              Browse all episodes
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
