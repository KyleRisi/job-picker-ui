import type { Metadata } from 'next';
import { EpisodeDiscoveryRail } from '@/components/episode-discovery-rail';
import { EpisodesBrowser } from '@/components/episodes-browser';
import { JoinPatreonCta } from '@/components/join-patreon-cta';
import { getEpisodesLandingPageData } from '@/lib/episodes';
import { getPodcastEpisodes, type PodcastEpisode } from '@/lib/podcast';
import { getPublicSiteUrl } from '@/lib/site-url';

type EpisodesPageProps = {
  searchParams?: {
    view?: string | string[];
    sort?: string | string[];
    page?: string | string[];
  };
};

type ViewMode = 'grid' | 'compact';
type SortOrder = 'newest' | 'oldest';
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

function normalizeSortOrder(value: string | string[] | undefined): SortOrder {
  const normalized = normalizeSingleValue(value);
  return normalized === 'oldest' ? 'oldest' : 'newest';
}

function normalizePageNumber(value: string | string[] | undefined): number {
  const normalized = normalizeSingleValue(value);
  if (!normalized) return 1;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function toPreservedSearchParams(searchParams?: EpisodesPageProps['searchParams']): URLSearchParams | undefined {
  const nextParams = new URLSearchParams();
  const view = normalizeViewMode(searchParams?.view);
  const sort = normalizeSortOrder(searchParams?.sort);
  if (view) nextParams.set('view', view);
  if (sort !== 'newest') nextParams.set('sort', sort);
  return nextParams.size ? nextParams : undefined;
}

export default async function EpisodesPage({ searchParams }: EpisodesPageProps) {
  const initialViewMode = normalizeViewMode(searchParams?.view);
  const initialSortOrder = normalizeSortOrder(searchParams?.sort);
  const requestedPage = normalizePageNumber(searchParams?.page);
  const preservedSearchParams = toPreservedSearchParams(searchParams);
  const siteUrl = getPublicSiteUrl();
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: 'Episodes', item: `${siteUrl}/episodes` }
    ]
  };

  let episodes: PodcastEpisode[] = [];
  let rails: Array<{ key: string; title: string; href: string; episodes: PodcastEpisode[] }> = [];
  let hasFeedError = false;

  try {
    const landingData = await getEpisodesLandingPageData();
    episodes = landingData.episodes;
    rails = landingData.rails;
  } catch (error) {
    hasFeedError = true;
    console.error('Failed to load episode landing data:', error);
    try {
      episodes = await getPodcastEpisodes({ descriptionMaxLength: 520 });
    } catch (fallbackError) {
      console.error('Failed to load podcast episodes fallback:', fallbackError);
    }
  }

  const totalPages = Math.max(1, Math.ceil(episodes.length / EPISODES_PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const pageStart = (page - 1) * EPISODES_PAGE_SIZE;
  const pagedEpisodes = episodes.slice(pageStart, pageStart + EPISODES_PAGE_SIZE);
  const displayedEpisodeCount = episodes.length + ARCHIVED_PATREON_EPISODE_BASELINE;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

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
              Browse every episode from newest to oldest, search by title or episode number, and explore curated discovery rails.
            </p>
          </div>
        </div>
      </section>

      <section className="relative z-10 isolate pt-6 md:pt-8">
        <div className="relative z-10 space-y-10">
          {hasFeedError ? (
            <p className="rounded-md border border-carnival-red/30 bg-carnival-red/10 px-4 py-3 font-semibold text-carnival-ink">
              We could not load all episode landing data right now. Showing what we can.
            </p>
          ) : null}

          {rails.length ? (
            <div className="space-y-10">
              {rails.map((rail) => (
                <EpisodeDiscoveryRail key={rail.key} title={rail.title} href={rail.href} episodes={rail.episodes} />
              ))}
            </div>
          ) : null}

          <EpisodesBrowser
            episodes={pagedEpisodes}
            searchEpisodes={episodes}
            initialViewMode={initialViewMode}
            initialSortOrder={initialSortOrder}
            sectionId="catalogue"
            sectionTitle="All Episodes"
            showFeaturedEpisode={false}
            pagination={{ page, totalPages }}
            basePath="/episodes"
            preservedSearchParams={preservedSearchParams}
          />
        </div>
      </section>

      <div className="-mb-8 pt-8">
        <JoinPatreonCta />
      </div>
    </>
  );
}
