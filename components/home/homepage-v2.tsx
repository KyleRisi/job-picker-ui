import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import fs from 'node:fs';
import path from 'node:path';
import { getEpisodesLandingPageData } from '@/lib/episodes';
import { getPodcastEpisodes, type PodcastEpisode } from '@/lib/podcast';
import { getVisibleReviews, getVisibleReviewsCount, type PublicReview } from '@/lib/reviews';
import { getPublicSiteUrl } from '@/lib/site-url';
import type { HomepageV2Environment } from '@/lib/homepage-v2/env';
import {
  buildHomepageV2AutoSeedContent,
  getHomepageV2Content,
  type HomepageV2Content,
  type HomepageV2CuratedCard,
  type HomepageV2Pillar
} from '@/lib/homepage-v2/content';
import { HOMEPAGE_V2_PAGE_VERSION } from '@/lib/homepage-v2/tracking';
import { HomepageV2EventTracker } from '@/components/home/homepage-v2-event-tracker';
import { HomepageEpisodeCard } from '@/components/home/homepage-episode-card';
import { HomepageTopicCard } from '@/components/home/homepage-topic-card';
import { HomepageNewsletterStatusNotice } from '@/components/home/homepage-newsletter-status-notice';
import { ReviewsSection } from '@/components/reviews-section';

const SPOTIFY_URL = 'https://open.spotify.com/show/30Hh0xbotgbIyCL5tJE4zJ';
const APPLE_PODCASTS_URL = 'https://podcasts.apple.com/gb/podcast/the-compendium-an-assembly-of-fascinating-things/id1676817109';
const TOPIC_CARD_BG_FOLDER = 'topic-hub-card-backgrounds';
const TOPIC_CARD_BG_EXTENSIONS = ['avif', 'webp', 'png', 'jpg', 'jpeg'];
const PATREON_BENEFITS = [
  {
    id: 'benefit-early-access',
    emoji: '🎧',
    title: 'Early access to new episodes',
    body: 'Members get episodes earlier, so you can listen before the rest of the internet catches up.'
  },
  {
    id: 'benefit-ad-free',
    emoji: '🔕',
    title: 'Ad-free listening on supported tiers',
    body: 'Skip ad interruptions in the main feed on tiers that include ad-free playback.'
  },
  {
    id: 'benefit-bonus-back-catalogue',
    emoji: '🗂️',
    title: 'bonusback catalog',
    body: 'Go beyond the public archive with extra episodes and additional context drops.'
  },
  {
    id: 'benefit-keychain',
    emoji: '🗝️',
    title: 'Keychain perks on eligible tiers',
    body: 'Physical supporter perks kick in on specific membership levels and timelines.'
  }
] as const;

function resolveTopicCardBackgroundUrl(slug: string): string | null {
  for (const extension of TOPIC_CARD_BG_EXTENSIONS) {
    const fileName = `${slug}.${extension}`;
    const filePath = path.join(process.cwd(), 'public', TOPIC_CARD_BG_FOLDER, fileName);
    if (fs.existsSync(filePath)) return `/${TOPIC_CARD_BG_FOLDER}/${fileName}`;
  }
  return null;
}

export const homepageV2Metadata: Metadata = {
  title: {
    absolute: 'True Crime, History & Incredible People | The Compendium'
  },
  description:
    'A weekly podcast covering true crime, history and incredible people. Start with standout episodes and listen on Spotify or Apple Podcasts.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'True Crime, History & Incredible People | The Compendium',
    description:
      'A weekly podcast covering true crime, history and incredible people. Start with standout episodes and listen on Spotify or Apple Podcasts.',
    url: '/',
    siteName: 'The Compendium Podcast',
    type: 'website',
    images: [{ url: '/The Compendium Main.jpg', width: 1200, height: 1200, alt: 'The Compendium Podcast artwork' }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'True Crime, History & Incredible People | The Compendium',
    description:
      'A weekly podcast covering true crime, history and incredible people. Start with standout episodes and listen on Spotify or Apple Podcasts.',
    images: ['/The Compendium Main.jpg']
  }
};

type CuratedCardView = {
  card: HomepageV2CuratedCard;
  episode: PodcastEpisode | null;
};

function truncate(value: string, maxLength: number): string {
  const normalized = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function toEpisodeMap(episodes: PodcastEpisode[]) {
  const map = new Map<string, PodcastEpisode>();
  episodes.forEach((episode) => {
    const slug = `${episode.slug || ''}`.trim().toLowerCase();
    if (!slug) return;
    if (map.has(slug)) return;
    map.set(slug, episode);
  });
  return map;
}

function firstEpisodeForPillar(episodes: PodcastEpisode[], pillar: HomepageV2Pillar): PodcastEpisode | null {
  const targetTopic = pillar === 'true_crime'
    ? 'true-crime'
    : pillar === 'history'
      ? 'history'
      : 'incredible-people';
  return episodes.find((episode) => episode.primaryTopicSlug === targetTopic) || null;
}

function resolveCuratedCardViews(cards: HomepageV2CuratedCard[], episodes: PodcastEpisode[]): CuratedCardView[] {
  const bySlug = toEpisodeMap(episodes);
  return cards.map((card) => {
    const explicit = bySlug.get(`${card.episodeSlug || ''}`.trim().toLowerCase()) || null;
    const fallback = explicit ? null : firstEpisodeForPillar(episodes, card.pillar);
    return { card, episode: explicit || fallback };
  });
}

function eventAttrs(eventName: string, properties: Record<string, string> = {}) {
  return {
    'data-homepage-v2-event': eventName,
    ...Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [`data-homepage-v2-${key}`, value])
    )
  };
}

function pillarDisplayName(pillar: HomepageV2Pillar): string {
  if (pillar === 'true_crime') return 'True Crime';
  if (pillar === 'history') return 'History';
  return 'Incredible People';
}

function pillarTrackingValue(pillar: HomepageV2Pillar): string {
  if (pillar === 'true_crime') return 'true_crime';
  if (pillar === 'history') return 'history';
  return 'incredible_people';
}

function PodcastJsonLd({ episodes }: { episodes: PodcastEpisode[] }) {
  const siteUrl = getPublicSiteUrl();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'PodcastSeries',
    name: 'The Compendium Podcast',
    description:
      'A weekly podcast covering true crime, fascinating history, and incredible people. Hosted by Kyle Risi and Adam Cox.',
    url: siteUrl,
    image: `${siteUrl}/The%20Compendium%20Main.jpg`,
    author: [
      { '@type': 'Person', name: 'Kyle Risi' },
      { '@type': 'Person', name: 'Adam Cox' }
    ],
    numberOfEpisodes: episodes.length,
    webFeed: 'https://feeds.simplecast.com/Sci7Fqgp'
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
}

function findEpisodeArtwork(episode: PodcastEpisode | null): string {
  return `${episode?.artworkUrl || ''}`.trim() || '/The Compendium Main.jpg';
}

function resolvePreviewLabel(environment: HomepageV2Environment): string {
  return environment === 'preview' ? 'preview' : 'production';
}

function formatFullPublishedDate(value: string | null | undefined): string | null {
  const raw = `${value || ''}`.trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(parsed);
}

function renderCuratedCard(args: {
  item: CuratedCardView;
  index: number;
  eventName: 'homepage_start_here_click' | 'homepage_popular_episode_click';
  section: 'start_here' | 'popular_with_listeners';
}) {
  const { item, index, eventName, section } = args;
  const { card, episode } = item;
  const slug = `${episode?.slug || card.episodeSlug}`.trim();
  const href = slug ? `/episodes/${slug}` : '/episodes';
  const title = `${episode?.title || 'Featured episode'}`.trim();
  const rawDescription = `${card.customBlurb || episode?.description || ''}`.replace(/\s+/g, ' ').trim();
  const blurb = truncate(card.customBlurb || episode?.description || '', section === 'start_here' ? 190 : 160);
  const excerptClampClass = section === 'start_here' ? 'line-clamp-2 md:line-clamp-5' : 'line-clamp-3 md:line-clamp-5';
  const mobileSummary = rawDescription;
  const publishedDate = formatFullPublishedDate(episode?.publishedAt);
  const mobileMeta = [
    episode?.episodeNumber ? `Ep ${episode.episodeNumber}` : null,
    episode?.duration || null,
    publishedDate
  ].filter(Boolean).join(' • ');

  return (
    <HomepageEpisodeCard
      key={`${section}-${slug || index}`}
      href={href}
      title={title}
      artworkSrc={findEpisodeArtwork(episode)}
      artworkAlt={episode ? `${episode.title} artwork` : 'Episode artwork'}
      eyebrow={card.pillarLabel || pillarDisplayName(card.pillar)}
      blurb={blurb}
      mobileSummary={mobileSummary}
      mobileMeta={mobileMeta}
      excerptClampClass={excerptClampClass}
      primaryLinkProps={eventAttrs(eventName, {
        section,
        destination: 'episode_page',
        pillar: pillarTrackingValue(card.pillar),
        'episode-slug': slug
      })}
      secondaryLinkProps={eventAttrs(eventName, {
        section,
        destination: 'episode_page',
        pillar: pillarTrackingValue(card.pillar),
        'episode-slug': slug
      })}
    />
  );
}

export async function HomepageV2({
  environment,
  pagePath
}: {
  environment: HomepageV2Environment;
  pagePath: '/' | '/preview/homepage-v2';
}) {
  let episodes: PodcastEpisode[] = [];
  let reviews: PublicReview[] = [];
  let reviewCount = 0;

  const [episodesResult, reviewsResult, reviewCountResult] = await Promise.allSettled([
    getEpisodesLandingPageData(),
    getVisibleReviews(12),
    getVisibleReviewsCount()
  ]);

  if (episodesResult.status === 'fulfilled') {
    episodes = episodesResult.value.episodes;
  } else {
    console.error('Failed to load homepage v2 episode landing data:', episodesResult.reason);
    try {
      episodes = await getPodcastEpisodes({ descriptionMaxLength: 520, limit: 24 });
    } catch (fallbackError) {
      console.error('Failed to load homepage v2 episode fallback:', fallbackError);
      episodes = [];
    }
  }

  if (reviewsResult.status === 'fulfilled') {
    reviews = reviewsResult.value;
  } else {
    console.error('Failed to load homepage v2 reviews:', reviewsResult.reason);
    reviews = [];
  }

  if (reviewCountResult.status === 'fulfilled') {
    reviewCount = reviewCountResult.value;
  } else {
    reviewCount = reviews.length;
  }

  let content: HomepageV2Content;

  try {
    const resolved = await getHomepageV2Content({ episodes, reviews });
    content = resolved.content;
  } catch (error) {
    console.error('Failed to load Homepage V2 curated content from settings. Falling back to generated defaults.', error);
    content = buildHomepageV2AutoSeedContent(episodes.slice(0, 24), reviews.slice(0, 4));
  }

  const latestEpisode = episodes[0] || null;
  const startHereCards = resolveCuratedCardViews(content.startHereCards, episodes);
  const popularCards = resolveCuratedCardViews(content.popularCards, episodes);
  const sectionBadgeClass = 'inline-block rounded-full bg-carnival-red px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white';
  const explorePanelClass = 'relative mx-auto max-w-6xl px-6 py-20 md:px-8 md:py-28';
  const exploreTopics = [
    {
      title: 'True Crime',
      slug: 'true-crime',
      href: '/topics/true-crime',
      pillar: 'true_crime',
      description: 'Case files with clean timelines, key evidence, and the details that actually matter.',
    },
    {
      title: 'History',
      slug: 'history',
      href: '/topics/history',
      pillar: 'history',
      description: 'Turning-point moments, strange decisions, and ripple effects still shaping the world now.',
    },
    {
      title: 'Incredible People',
      slug: 'incredible-people',
      href: '/topics/incredible-people',
      pillar: 'incredible_people',
      description: 'Wildly influential people, sharp backstories, and choices that made them unforgettable.',
    }
  ] as const;

  return (
    <>
      <PodcastJsonLd episodes={episodes} />
      <HomepageV2EventTracker environment={environment} pagePath={pagePath} />

      <section data-homepage-v2-root="true" className="full-bleed relative -mt-8 overflow-hidden bg-carnival-ink">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-carnival-red/25 blur-[120px]" />
          <div className="absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-carnival-gold/20 blur-[120px]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-0 px-4 pb-8 pt-8 md:grid-cols-[400px_1fr] md:items-center md:pb-10 md:pt-20">
          <div className="mx-auto w-full max-w-[230px] md:mx-0 md:max-w-none">
            <Image
              src="/The Compendium Main.jpg"
              alt="The Compendium Podcast artwork"
              width={360}
              height={360}
              className="rounded-lg border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
              priority
              sizes="(max-width: 768px) 230px, 460px"
            />
          </div>

          <div className="pt-4 text-center md:pt-0 md:text-left">
            <p className="inline-flex rounded-full bg-carnival-red px-3 py-1 text-xs font-black uppercase tracking-[0.08em] text-white">Step right up to</p>
            <h1 className="mt-3 text-[30px] font-black leading-[1] text-white md:text-[48px]">
              The Compendium Podcast
            </h1>
            <p className="mt-3 whitespace-nowrap text-xs font-black uppercase tracking-[0.06em] text-carnival-gold md:text-base md:tracking-[0.1em]">
              True Crime • History • Incredible People
            </p>
            <p className="mt-5 text-base leading-relaxed text-white/90">
              {content.heroSupportingCopy}
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <a
                href={SPOTIFY_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-md bg-[#1DB954] px-4 text-sm font-black uppercase tracking-wide text-white transition hover:brightness-110"
                {...eventAttrs('homepage_spotify_click', {
                  section: 'hero',
                  destination: 'spotify'
                })}
              >
                Listen on Spotify
              </a>
              <a
                href={APPLE_PODCASTS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-md bg-[#9933CC] px-4 text-sm font-black uppercase tracking-wide text-white transition hover:brightness-110"
                {...eventAttrs('homepage_apple_click', {
                  section: 'hero',
                  destination: 'apple_podcasts'
                })}
              >
                Listen on Apple Podcasts
              </a>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm md:justify-start">
              <a
                href="#never-miss"
                className="inline-flex items-center font-semibold text-white/80 underline-offset-4 transition hover:text-white hover:underline"
              >
                Get weekly episode updates
              </a>
              <span aria-hidden="true" className="hidden text-white/35 md:inline">
                •
              </span>
              <Link
                href="/patreon"
                className="inline-flex items-center font-semibold text-carnival-gold/90 underline-offset-4 transition hover:text-carnival-gold hover:underline"
                {...eventAttrs('homepage_patreon_click', {
                  section: 'hero',
                  destination: 'patreon'
                })}
              >
                Support on Patreon
              </Link>
            </div>

          </div>
        </div>
      </section>

      <section id="popular-with-listeners" className="full-bleed bg-carnival-gold">
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <header className="mb-6 space-y-2">
            <span className={sectionBadgeClass}>Start Here</span>
            <h2 className="text-3xl font-black text-carnival-ink md:text-4xl">New to the Circus? Start Here</h2>
            <p className="text-carnival-ink/80">Three brilliant first listens - one from each pillar.</p>
          </header>
          <div className="grid gap-5 md:grid-cols-3">
            {startHereCards.map((item, index) => renderCuratedCard({
              item,
              index,
              eventName: 'homepage_start_here_click',
              section: 'start_here'
            }))}
          </div>
        </div>
      </section>

      <section className="full-bleed relative overflow-hidden bg-carnival-ink">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-20 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-carnival-red/20 blur-[120px]" />
          <div className="absolute -right-20 top-1/3 h-60 w-60 rounded-full bg-carnival-gold/15 blur-[100px]" />
        </div>
        <div className={explorePanelClass}>
          <header className="mb-6 space-y-2">
            <span className={sectionBadgeClass}>Explore</span>
            <h2 className="text-3xl font-black text-white md:text-4xl">Explore the Show</h2>
            <p className="text-white/80">Pick your lane: true crime, history, or incredible people.</p>
          </header>

          <div className="grid gap-5 md:grid-cols-3">
            {exploreTopics.map((topic) => {
              const backgroundUrl = resolveTopicCardBackgroundUrl(topic.slug);

              return (
                <article key={topic.slug}>
                  <HomepageTopicCard
                    href={topic.href}
                    title={topic.title}
                    description={topic.description}
                    backgroundUrl={backgroundUrl}
                    eventProps={eventAttrs('homepage_pillar_click', {
                      section: 'explore_show',
                      destination: 'topic_page',
                      pillar: topic.pillar,
                      'topic-slug': topic.slug
                    })}
                  />
                </article>
              );
            })}
          </div>
          <div className="mt-6 flex w-full justify-center pt-1 md:mt-7">
            <Link
              href="/topics"
              className="btn-primary"
              {...eventAttrs('homepage_pillar_click', {
                section: 'explore_show',
                destination: 'topics_index',
                pillar: 'all_topics'
              })}
            >
              Browse all topics
            </Link>
          </div>
        </div>
      </section>

      <section className="full-bleed" style={{ backgroundColor: 'var(--brand-cream)' }}>
        <div className="mx-auto max-w-6xl px-4 py-20 md:py-28">
          <header className="mb-6 space-y-2">
            <span className={sectionBadgeClass}>Why Listen</span>
            <h2 className="text-3xl font-black text-carnival-ink md:text-4xl">Why Freaks Keep Coming Back</h2>
            <p className="text-carnival-ink/80">Built for curious minds who want the good stuff without a 10-episode slog.</p>
          </header>

          <div className="grid gap-4 md:grid-cols-3">
            <article className="group relative overflow-hidden rounded-2xl border border-white/20 bg-carnival-ink p-6 shadow-[0_16px_34px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(0,0,0,0.45)]">
              <div aria-hidden className="pointer-events-none absolute -left-16 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-carnival-red/20 blur-[110px]" />
              <div aria-hidden className="pointer-events-none absolute -right-14 bottom-0 h-40 w-40 rounded-full bg-carnival-gold/15 blur-[100px]" />
              <p className="relative text-[11px] font-black uppercase tracking-[0.16em] text-carnival-gold">Story Shape</p>
              <h3 className="relative text-xl font-black text-white">One story, one satisfying listen</h3>
              <p className="relative mt-3 text-sm leading-relaxed text-white/85">
                Each episode delivers the full arc in one sitting, so you get payoff without a homework assignment.
              </p>
            </article>
            <article className="group relative overflow-hidden rounded-2xl border border-white/20 bg-carnival-ink p-6 shadow-[0_16px_34px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(0,0,0,0.45)]">
              <div aria-hidden className="pointer-events-none absolute -left-16 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-carnival-red/20 blur-[110px]" />
              <div aria-hidden className="pointer-events-none absolute -right-14 bottom-0 h-40 w-40 rounded-full bg-carnival-gold/15 blur-[100px]" />
              <p className="relative text-[11px] font-black uppercase tracking-[0.16em] text-carnival-gold">Range</p>
              <h3 className="relative text-xl font-black text-white">Variety without chaos</h3>
              <p className="relative mt-3 text-sm leading-relaxed text-white/85">
                Crime, history, and extraordinary people share one stage, so the mix stays fresh, not all over the place.
              </p>
            </article>
            <article className="group relative overflow-hidden rounded-2xl border border-white/20 bg-carnival-ink p-6 shadow-[0_16px_34px_rgba(0,0,0,0.35)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_24px_48px_rgba(0,0,0,0.45)]">
              <div aria-hidden className="pointer-events-none absolute -left-16 top-1/2 h-56 w-56 -translate-y-1/2 rounded-full bg-carnival-red/20 blur-[110px]" />
              <div aria-hidden className="pointer-events-none absolute -right-14 bottom-0 h-40 w-40 rounded-full bg-carnival-gold/15 blur-[100px]" />
              <p className="relative text-[11px] font-black uppercase tracking-[0.16em] text-carnival-gold">Delivery</p>
              <h3 className="relative text-xl font-black text-white">Sharp storytelling with personality</h3>
              <p className="relative mt-3 text-sm leading-relaxed text-white/85">
                Solid research, sharp delivery, and just enough circus nonsense to make it unmistakably Compendium.
              </p>
            </article>
          </div>

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-3 text-xs font-semibold uppercase tracking-wide text-white">
            <li className="w-full max-w-[220px] rounded-full bg-carnival-red px-4 py-2 text-center">Weekly episodes</li>
            <li className="w-full max-w-[220px] rounded-full bg-carnival-red px-4 py-2 text-center">
              {Math.max(episodes.length, 150)}+ episodes
            </li>
            <li className="w-full max-w-[220px] rounded-full bg-carnival-red px-4 py-2 text-center">
              {Math.max(reviewCount, 100)}+ listener reviews
            </li>
          </ul>
        </div>
      </section>

      {latestEpisode ? (
        <section className="pt-12 md:pt-16">
          <header className="mb-6 space-y-2">
            <span className={sectionBadgeClass}>Latest</span>
            <h2 className="text-3xl font-black text-carnival-ink md:text-4xl">Latest Episode</h2>
            <p className="text-carnival-ink/80">Fresh from the big top.</p>
          </header>

          <article className="card grid gap-6 md:grid-cols-[220px_1fr] md:items-center">
            <div className="relative aspect-square overflow-hidden rounded-xl border border-carnival-ink/15">
              <Image
                src={findEpisodeArtwork(latestEpisode)}
                alt={`${latestEpisode.title} artwork`}
                fill
                sizes="(max-width: 768px) 100vw, 220px"
                className="object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-carnival-red">{latestEpisode.primaryTopicName || 'Featured episode'}</p>
              <h3 className="mt-2 text-2xl font-black text-carnival-ink">{latestEpisode.title}</h3>
              <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-carnival-ink/80">
                {truncate(latestEpisode.description, 320)}
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <a
                  href={SPOTIFY_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-[#1DB954] px-3 text-sm font-bold text-white transition hover:brightness-110"
                  {...eventAttrs('homepage_latest_episode_click', {
                    section: 'latest_episode',
                    destination: 'spotify',
                    'episode-slug': latestEpisode.slug
                  })}
                >
                  Listen on Spotify
                </a>
                <a
                  href={APPLE_PODCASTS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-[#9933CC] px-3 text-sm font-bold text-white transition hover:brightness-110"
                  {...eventAttrs('homepage_latest_episode_click', {
                    section: 'latest_episode',
                    destination: 'apple_podcasts',
                    'episode-slug': latestEpisode.slug
                  })}
                >
                  Listen on Apple Podcasts
                </a>
                <Link
                  href={`/episodes/${latestEpisode.slug}`}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-carnival-ink/20 bg-white px-3 text-sm font-bold text-carnival-ink transition hover:border-carnival-red/45 hover:text-carnival-red"
                  {...eventAttrs('homepage_latest_episode_click', {
                    section: 'latest_episode',
                    destination: 'episode_page',
                    'episode-slug': latestEpisode.slug
                  })}
                >
                  Read episode page
                </Link>
              </div>
            </div>
          </article>
        </section>
      ) : null}

      <section className="pt-12 md:pt-16">
        <header className="mb-6 space-y-2">
          <span className={sectionBadgeClass}>Popular</span>
          <h2 className="text-3xl font-black text-carnival-ink md:text-4xl">Popular With Listeners</h2>
          <p className="text-carnival-ink/80">A few fan favourites from under the big top.</p>
        </header>

        <div className="grid gap-5 md:grid-cols-3">
          {popularCards.slice(0, 3).map((item, index) => renderCuratedCard({
            item,
            index,
            eventName: 'homepage_popular_episode_click',
            section: 'popular_with_listeners'
          }))}
        </div>
        <div className="mt-10 flex justify-center">
          <Link
            href="/episodes"
            className="btn-primary"
            {...eventAttrs('homepage_popular_episode_click', {
              section: 'popular_with_listeners',
              destination: 'episodes_page'
            })}
          >
            Browse all episodes
          </Link>
        </div>
      </section>

      <section className="pt-12 md:pt-16">
        <header className="mb-6 space-y-2">
          <span className={sectionBadgeClass}>Reviews</span>
          <h2 className="text-3xl font-black text-carnival-ink md:text-4xl">What Listeners Are Saying</h2>
          <p className="text-carnival-ink/80">Suspiciously generous praise from the general public.</p>
        </header>
        <ReviewsSection
          reviews={reviews}
          totalCount={reviewCount}
          sectionClassName="py-0"
          ctaLabel={`Read ${reviewCount} more reviews`}
          ctaClassName="btn-primary"
          ctaMode="link"
          ctaLinkProps={eventAttrs('homepage_reviews_click', {
            section: 'reviews',
            destination: 'reviews_page'
          })}
          showHeader={false}
          showCtaAlways
        />
      </section>

      <section className="full-bleed" style={{ backgroundColor: 'var(--brand-cream)' }}>
        <div className="mx-auto max-w-6xl px-4 py-12 md:py-16">
          <header className="mb-6 space-y-2">
            <span className={sectionBadgeClass}>Hosts</span>
            <h2 className="text-3xl font-black text-carnival-ink md:text-4xl">Meet the Hosts</h2>
            <p className="text-carnival-ink/80">Two voices, one circus: stories, chaos, and suspiciously good admin.</p>
          </header>

          <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          <Link
            href="/author/kyle-risi"
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#6d1222] via-[#8d1e31] to-[#3f0a14] p-4 text-white shadow-[0_14px_34px_rgba(50,8,18,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(50,8,18,0.45)] sm:p-5"
            {...eventAttrs('homepage_hosts_click', {
              section: 'hosts',
              destination: 'host_page'
            })}
          >
            <div aria-hidden className="pointer-events-none absolute -left-16 top-8 h-56 w-56 rounded-full bg-[#d43d4f]/30 blur-[100px]" />
            <div aria-hidden className="pointer-events-none absolute -right-16 bottom-0 h-48 w-48 rounded-full bg-[#f6a35f]/20 blur-[90px]" />
            <div className="relative grid grid-cols-[120px_1fr] items-center gap-3 sm:grid-cols-[130px_1fr] md:grid-cols-[140px_1fr]">
              <div className="relative h-[170px] overflow-hidden rounded-xl border border-white/20 bg-black/15 sm:h-[182px] md:h-[198px]">
                <Image
                  src="/Kyle.webp"
                  alt="Kyle Risi"
                  fill
                  sizes="(max-width: 768px) 130px, 160px"
                  className="object-cover object-top"
                />
              </div>
              <div className="min-w-0">
                <span className="inline-flex rounded-full bg-[#c9271e] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.11em] text-white">
                  Ringmaster
                </span>
                <h3 className="mt-2 text-2xl font-black leading-tight text-white">Kyle Risi</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/88">
                  Head ringmaster. Kyle drives the stories, keeps the pace tight, and lands the big reveals.
                </p>
              </div>
            </div>
          </Link>

          <Link
            href="/author/adam-cox"
            className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#11264e] via-[#1f3c78] to-[#0a1731] p-4 text-white shadow-[0_14px_34px_rgba(9,24,54,0.35)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(9,24,54,0.45)] sm:p-5"
            {...eventAttrs('homepage_hosts_click', {
              section: 'hosts',
              destination: 'host_page'
            })}
          >
            <div aria-hidden className="pointer-events-none absolute -left-14 top-10 h-52 w-52 rounded-full bg-[#2f7adf]/28 blur-[100px]" />
            <div aria-hidden className="pointer-events-none absolute -right-16 bottom-0 h-44 w-44 rounded-full bg-[#78b0ff]/20 blur-[95px]" />
            <div className="relative grid grid-cols-[120px_1fr] items-center gap-3 sm:grid-cols-[130px_1fr] md:grid-cols-[140px_1fr]">
              <div className="relative h-[170px] overflow-hidden rounded-xl border border-white/20 bg-black/15 sm:h-[182px] md:h-[198px]">
                <Image
                  src="/Adam.webp"
                  alt="Adam Cox"
                  fill
                  sizes="(max-width: 768px) 130px, 160px"
                  className="object-cover object-top"
                />
              </div>
              <div className="min-w-0">
                <span className="inline-flex rounded-full bg-[#2196b2] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.11em] text-white">
                  Co-Host
                </span>
                <h3 className="mt-2 text-2xl font-black leading-tight text-white">Adam Cox</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/88">
                  Co-host and resident wildcard, tackling whatever deeply specific circus job appears this week.
                </p>
              </div>
            </div>
          </Link>
          </div>
        </div>
      </section>

      <section className="pt-12 md:pt-16">
        <header className="mb-6 space-y-2">
          <span className={sectionBadgeClass}>Patreon</span>
          <h2 className="text-3xl font-black text-carnival-ink md:text-4xl">Go Behind the Curtain</h2>
          <p className="text-carnival-ink/80">For listeners who want Compendium, fewer ads and a little extra chaos then become a certified freak and join us on Patreon.</p>
        </header>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PATREON_BENEFITS.map((benefit) => (
            <article key={benefit.id} className="rounded-2xl bg-carnival-ink p-5 text-white shadow-card">
              <p className="text-xl" aria-hidden="true">{benefit.emoji}</p>
              <h3 className="mt-2 text-2xl font-bold leading-tight">{benefit.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/82">{benefit.body}</p>
            </article>
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <Link
            href="/patreon"
            className="btn-primary"
            {...eventAttrs('homepage_patreon_click', {
              section: 'patreon',
              destination: 'patreon'
            })}
          >
            See Patreon tiers
          </Link>
          <Link
            href="/patreon#how-it-works"
            className="inline-flex h-[44px] items-center justify-center rounded-md border border-carnival-ink/20 bg-white px-4 font-semibold text-carnival-ink transition hover:border-carnival-red/45 hover:text-carnival-red"
            {...eventAttrs('homepage_patreon_click', {
              section: 'patreon',
              destination: 'patreon'
            })}
          >
            How Patreon works
          </Link>
        </div>
      </section>

      <section className="pt-10 md:pt-12">
        <div className="full-bleed border-y border-carnival-ink/12 py-10 text-carnival-ink md:py-12" style={{ backgroundColor: 'var(--brand-cream)' }}>
          <div className="mx-auto max-w-3xl px-4 text-center">
            <span className="inline-block rounded-full bg-carnival-red px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white">Community</span>
            <h2 className="mt-3 text-3xl font-black md:text-4xl">There&apos;s Always Room Under the Tent</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-carnival-ink/80">
              One final stop before the lights go down: hit play, get weekly episode drops, or back the show.
            </p>

            <div className="mt-6 grid gap-2 sm:grid-cols-3">
              <Link
                href="/episodes"
                className="btn-primary h-11 w-full"
                {...eventAttrs('homepage_popular_episode_click', {
                  section: 'community',
                  destination: 'episodes_page'
                })}
              >
                Listen now
              </Link>
              <a
                href="#never-miss"
                className="inline-flex h-11 w-full items-center justify-center rounded-md border border-carnival-ink/25 bg-white/55 px-4 text-sm font-bold text-carnival-ink transition hover:bg-white/75"
              >
                Join mailing list
              </a>
              <Link
                href="/patreon"
                className="inline-flex h-11 w-full items-center justify-center rounded-md border border-carnival-red/35 bg-transparent px-4 text-sm font-bold text-carnival-red transition hover:bg-carnival-red/10"
                {...eventAttrs('homepage_patreon_click', {
                  section: 'community',
                  destination: 'patreon'
                })}
              >
                Support on Patreon
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="never-miss" className="full-bleed relative mt-12 overflow-hidden bg-carnival-ink md:mt-16">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-20 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-carnival-red/20 blur-[120px]" />
          <div className="absolute -right-20 top-1/3 h-60 w-60 rounded-full bg-carnival-gold/15 blur-[100px]" />
        </div>

        <div className={explorePanelClass}>
          <header className="mb-6 space-y-2 text-center">
            <span className={sectionBadgeClass}>Newsletter</span>
            <h2 className="text-3xl font-black text-white md:text-4xl">Never Miss an Episode</h2>
            <p className="mx-auto max-w-2xl text-[15px] leading-relaxed text-white/90 sm:text-base">
              Get weekly episode alerts, curated listening picks, and the occasional dispatch from inside the circus tent. No spam. Just fascinating stories and where to start next.
            </p>
          </header>

          <div className="mx-auto w-full max-w-2xl rounded-xl border border-white/15 bg-white/[0.04] p-4 md:p-5">
            <form method="post" action="/api/newsletter/subscribe" className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
              <input type="hidden" name="redirect_to" value={`${pagePath}#never-miss`} />
              <input type="hidden" name="source_section" value="email_signup" />
              <input type="hidden" name="page_version" value={HOMEPAGE_V2_PAGE_VERSION} />
              <input type="hidden" name="environment" value={resolvePreviewLabel(environment)} />
              <div className="hidden" aria-hidden="true">
                <label htmlFor="company">Company</label>
                <input id="company" name="company" type="text" autoComplete="off" tabIndex={-1} defaultValue="" />
              </div>
              <label htmlFor="newsletter-email" className="sr-only">Email address</label>
              <input
                id="newsletter-email"
                name="email"
                type="email"
                required
                className="h-[46px] w-full rounded-md border border-white/25 bg-white/5 px-3 text-base text-white placeholder:text-white/55 focus:border-carnival-gold/70 focus:outline-none focus:ring-2 focus:ring-carnival-gold/35"
                placeholder="Email address"
                autoComplete="email"
                inputMode="email"
              />
              <button type="submit" className="btn-primary h-[46px] w-full px-5 md:w-auto md:justify-self-start">
                Join mailing list
              </button>
            </form>
            <HomepageNewsletterStatusNotice />
          </div>
        </div>
      </section>

    </>
  );
}
