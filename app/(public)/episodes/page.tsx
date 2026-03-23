import type { Metadata } from 'next';
import { EpisodesBrowser } from '@/components/episodes-browser';
import { BrokenHealthEpisodesTracker } from '@/components/broken-health-episodes-tracker';
import { JoinPatreonCta } from '@/components/join-patreon-cta';
import { getEpisodesLandingPageData } from '@/lib/episodes';
import { getPodcastEpisodes, type PodcastEpisode } from '@/lib/podcast';
import { getPublicSiteUrl } from '@/lib/site-url';
import { compactJsonLd, getPageEntityIds, resolveCanonicalForSchema, toAbsoluteSchemaUrl } from '@/lib/schema-jsonld';

type EpisodesPageProps = {
  searchParams?: {
    view?: string | string[];
    page?: string | string[];
    topic?: string | string[];
  };
};

type ViewMode = 'grid' | 'compact';
const EPISODES_PAGE_SIZE = 12;
const ARCHIVED_PATREON_EPISODE_BASELINE = 19;

export const revalidate = 300;

export const metadata: Metadata = {
  title: {
    absolute: 'All Episodes | The Compendium Podcast'
  },
  description:
    'Browse every Compendium podcast episode in one place. Search by title or episode number, discover curated collections, and open full episode notes.',
  alternates: {
    canonical: '/episodes'
  },
  openGraph: {
    title: 'All Episodes | The Compendium Podcast',
    description:
      'Browse every Compendium podcast episode in one place. Search by title or episode number, discover curated collections, and open full episode notes.',
    url: '/episodes'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'All Episodes | The Compendium Podcast',
    description:
      'Browse every Compendium podcast episode in one place. Search by title or episode number, discover curated collections, and open full episode notes.'
  }
};

function normalizeSingleValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return `${value[0] || ''}`.trim().toLowerCase();
  return `${value || ''}`.trim().toLowerCase();
}

function normalizeViewMode(value: string | string[] | undefined): ViewMode | undefined {
  const normalized = normalizeSingleValue(value);
  if (normalized === 'grid' || normalized === 'compact') return normalized;
  return undefined;
}

function normalizePageNumber(value: string | string[] | undefined): number {
  const normalized = normalizeSingleValue(value);
  if (!normalized) return 1;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function normalizeTopicFilter(value: string | string[] | undefined): string | null {
  const normalized = normalizeSingleValue(value);
  if (!normalized) return null;
  if (!/^[a-z0-9-]+$/.test(normalized)) return null;
  return normalized;
}

function titleCaseFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((part) => `${part[0] || ''}`.toUpperCase() + part.slice(1))
    .join(' ');
}

function buildTopicToggleOptions(
  episodes: PodcastEpisode[]
): Array<{ label: string; value: string | null }> {
  const fallbackTerms = new Map<string, string>();
  episodes.forEach((episode) => {
    const slug = normalizeTopicFilter(episode.primaryTopicSlug || undefined);
    if (!slug || fallbackTerms.has(slug)) return;
    fallbackTerms.set(slug, episode.primaryTopicName || titleCaseFromSlug(slug));
  });

  const fallbackOptions = [...fallbackTerms.entries()]
    .sort((left, right) => left[1].localeCompare(right[1]))
    .map(([value, label]) => ({ label, value }));

  if (!fallbackOptions.length) return [];
  return [{ label: 'All episodes', value: null }, ...fallbackOptions];
}

function toPreservedSearchParams({
  view,
  topic
}: {
  view?: ViewMode;
  topic: string | null;
}): URLSearchParams | undefined {
  const nextParams = new URLSearchParams();
  if (view) nextParams.set('view', view);
  if (topic) nextParams.set('topic', topic);
  return nextParams.size ? nextParams : undefined;
}

function validateTopicFilter(
  requestedTopic: string | null,
  topicToggleOptions: Array<{ label: string; value: string | null }>
): string | null {
  if (!requestedTopic) return null;
  if (topicToggleOptions.some((option) => option.value === requestedTopic)) return requestedTopic;
  return null;
}

export default async function EpisodesPage({ searchParams }: EpisodesPageProps) {
  const initialViewMode = normalizeViewMode(searchParams?.view);
  const requestedTopicFilter = normalizeTopicFilter(searchParams?.topic);
  const requestedPage = normalizePageNumber(searchParams?.page);
  const siteUrl = getPublicSiteUrl();
  const canonical = resolveCanonicalForSchema({
    candidateCanonical: '/episodes',
    fallbackPath: '/episodes',
    siteUrl
  });
  const pageEntityIds = getPageEntityIds(canonical.absoluteCanonicalUrl);
  const breadcrumbJsonLd = compactJsonLd({
    '@context': 'https://schema.org',
    '@id': pageEntityIds.breadcrumb,
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: toAbsoluteSchemaUrl('/', siteUrl) },
      { '@type': 'ListItem', position: 2, name: 'Episodes', item: canonical.absoluteCanonicalUrl }
    ]
  });

  let episodes: PodcastEpisode[] = [];
  let hasFeedError = false;

  try {
    const landingData = await getEpisodesLandingPageData();
    episodes = landingData.episodes;
  } catch (error) {
    hasFeedError = true;
    console.error('Failed to load episode landing data:', error);
    try {
      episodes = await getPodcastEpisodes({ descriptionMaxLength: 520 });
    } catch (fallbackError) {
      console.error('Failed to load podcast episodes fallback:', fallbackError);
    }
  }

  const topicToggleOptions = buildTopicToggleOptions(episodes);
  const topicFilter = validateTopicFilter(requestedTopicFilter, topicToggleOptions);
  const preservedSearchParams = toPreservedSearchParams({
    view: initialViewMode,
    topic: topicFilter
  });
  const hasTopicCoverage = episodes.some((episode) => Boolean(episode.primaryTopicSlug));
  const filteredByTopicEpisodes = topicFilter && hasTopicCoverage
    ? episodes.filter((episode) => episode.primaryTopicSlug === topicFilter)
    : episodes;
  const sortedEpisodes = [...filteredByTopicEpisodes].sort((a, b) => {
    const left = Date.parse(a.publishedAt || '') || 0;
    const right = Date.parse(b.publishedAt || '') || 0;
    return right - left;
  });
  const sortedSearchEpisodes = [...episodes].sort((a, b) => {
    const left = Date.parse(a.publishedAt || '') || 0;
    const right = Date.parse(b.publishedAt || '') || 0;
    return right - left;
  });

  const totalPages = Math.max(1, Math.ceil(sortedEpisodes.length / EPISODES_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const displayedEpisodeCount = episodes.length + ARCHIVED_PATREON_EPISODE_BASELINE;
  const hasUnexpectedMissingPrimaryContent = !hasFeedError && episodes.length === 0;

  return (
    <>
      <BrokenHealthEpisodesTracker
        hasCriticalApiFailure={hasFeedError}
        hasUnexpectedMissingPrimaryContent={hasUnexpectedMissingPrimaryContent}
      />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <div className="flex min-h-[calc(100dvh-var(--app-shell-header-height,0px)-4rem)] flex-col">
        <section className="full-bleed relative -mt-8 overflow-hidden bg-carnival-ink pb-16 pt-16 md:pb-20 md:pt-20">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-carnival-red/30 blur-[120px]" />
            <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-carnival-gold/20 blur-[100px]" />
          </div>
          <div className="relative mx-auto max-w-6xl px-4">
            <div className="max-w-3xl">
              <p className="text-xs font-black uppercase tracking-[0.25em] text-carnival-gold">The Compendium Podcast</p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">All Episodes</h1>
                <span className="rounded-full border border-white/25 bg-carnival-red px-3 py-0.5 text-sm font-black text-white">
                  {displayedEpisodeCount}
                </span>
              </div>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
                Browse every episode, then search by title or episode number.
              </p>
            </div>
          </div>
        </section>

        <section className="relative z-10 isolate pt-6 pb-8 md:pt-8 md:pb-10">
          <div className="relative z-10 space-y-10">
            {hasFeedError ? (
              <p className="rounded-md border border-carnival-red/30 bg-carnival-red/10 px-4 py-3 font-semibold text-carnival-ink">
                We could not load all episode landing data right now. Showing what we can.
              </p>
            ) : null}

            <EpisodesBrowser
              episodes={sortedEpisodes}
              searchEpisodes={sortedSearchEpisodes}
              initialViewMode={initialViewMode}
              showSortToggle={false}
              mobileSortLeft
              topicFilter={topicFilter}
              topicToggleOptions={topicToggleOptions}
              sectionId="catalogue"
              showFeaturedEpisode={false}
              pagination={{ page, totalPages, pageSize: EPISODES_PAGE_SIZE }}
              basePath="/episodes"
              preservedSearchParams={preservedSearchParams}
            />
          </div>
        </section>

        <div className="full-bleed -mb-8 mt-auto bg-carnival-ink pt-8">
          <JoinPatreonCta />
        </div>
      </div>
    </>
  );
}
