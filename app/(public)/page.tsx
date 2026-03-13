import Image from 'next/image';
import Link from 'next/link';
import { getEpisodesLandingPageData } from '@/lib/episodes';
import type { PodcastEpisode } from '@/lib/podcast';
import { EpisodesBrowser } from '@/components/episodes-browser';
import type { Metadata } from 'next';
import { getVisibleReviews, getVisibleReviewsCount } from '@/lib/reviews';
import { getPublicSiteUrl } from '@/lib/site-url';
import { PATREON_INTERNAL_PATH } from '@/lib/patreon-links';

export const metadata: Metadata = {
  title: {
    absolute: 'The Compendium Podcast | True Crime, History & Incredible People'
  },
  description:
    'A weekly variety podcast covering true crime, forgotten historical events, and incredible people. Hosted by Kyle Risi and Adam Cox. Listen on Spotify, Apple Podcasts, and more.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'The Compendium Podcast | True Crime, History & Incredible People',
    description:
      'A weekly variety podcast covering true crime, forgotten historical events, and incredible people. New episodes every week.',
    url: '/',
    siteName: 'The Compendium Podcast',
    type: 'website',
    images: [{ url: '/The Compendium Main.jpg', width: 1200, height: 1200, alt: 'The Compendium Podcast artwork' }]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Compendium Podcast | True Crime, History & Incredible People',
    description: 'True crime, historical events, and incredible people — a new episode every week.',
    images: ['/The Compendium Main.jpg']
  }
};

/* ─── External links ─── */
import { ReviewsSection } from '@/components/reviews-section';

const SPOTIFY_URL = 'https://open.spotify.com/show/30Hh0xbotgbIyCL5tJE4zJ';
const APPLE_PODCASTS_URL = 'https://podcasts.apple.com/gb/podcast/the-compendium-an-assembly-of-fascinating-things/id1676817109';


/* ─── Podcast JSON-LD (SEO) ─── */
function PodcastJsonLd({ episodes }: { episodes: PodcastEpisode[] }) {
  const siteUrl = getPublicSiteUrl();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'PodcastSeries',
    name: 'The Compendium Podcast',
    description:
      'A weekly variety podcast that gives you everything you need to know on a topic to help stand your ground at a social gathering. True crime, historical events, and incredible people.',
    url: siteUrl,
    image: `${siteUrl}/The%20Compendium%20Main.jpg`,
    author: [
      { '@type': 'Person', name: 'Kyle Risi' },
      { '@type': 'Person', name: 'Adam Cox' }
    ],
    numberOfEpisodes: episodes.length,
    webFeed: 'https://feeds.simplecast.com/Sci7Fqgp'
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

/* ─── Page ─── */
export default async function HomePage() {
  let episodes: PodcastEpisode[] = [];
  let reviews = [];
  let reviewCount = 0;
  try {
    const [landingData, loadedReviews, loadedReviewCount] = await Promise.all([
      getEpisodesLandingPageData(),
      getVisibleReviews(9),
      getVisibleReviewsCount()
    ]);
    episodes = landingData.episodes;
    reviews = loadedReviews;
    reviewCount = loadedReviewCount;
  } catch (error) {
    console.error('Failed to load podcast episodes for home page:', error);
    reviews = await getVisibleReviews(9);
    reviewCount = reviews.length;
  }

  return (
    <>
      <PodcastJsonLd episodes={episodes} />

      {/* ════════════════════════════════════════════════
          HERO
         ════════════════════════════════════════════════ */}
      <section className="full-bleed relative -mt-8 overflow-hidden bg-carnival-ink">
        {/* Atmospheric glow */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-carnival-red/30 blur-[120px]" />
          <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-carnival-gold/20 blur-[100px]" />
        </div>

        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-16 md:grid-cols-[380px_1fr] md:items-center md:py-24">
          <div className="mx-auto w-full max-w-[320px] md:mx-0 md:max-w-none">
            <Image
              src="/The Compendium Main.jpg"
              alt="The Compendium Podcast artwork"
              width={380}
              height={380}
              className="rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
              priority
            />
          </div>

          <div className="text-center md:text-left">
            <span className="inline-block rounded-full bg-carnival-red px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white">
              The Compendium Podcast
            </span>
            <h1 className="mt-4 text-3xl font-black leading-[1.1] text-white sm:text-4xl md:text-[2.75rem]">
              An Assembly of<br />Fascinating Things!
            </h1>
            <p className="mt-3 text-sm font-bold uppercase tracking-wide text-carnival-gold">
              True Crime &nbsp;|&nbsp; Historical Events &nbsp;|&nbsp; Incredible People
            </p>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/85 md:mx-0">
              A weekly variety podcast that gives you everything you need to know on a topic to help
              stand your ground at a social gathering. We explore stories from the darker corners of
              true crime, forgotten historical events, and incredible people.
            </p>

            <p className="mb-3 mt-8 text-xs font-black uppercase tracking-widest text-white/60">
              Subscribe and Listen on
            </p>
            <div className="flex flex-wrap justify-center gap-3 md:justify-start">
              <a
                href={SPOTIFY_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#1DB954] px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
                Spotify
              </a>
              <Link
                href={PATREON_INTERNAL_PATH}
                className="inline-flex items-center gap-2 rounded-full bg-carnival-red px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
              >
                <Image src="/patreon-icon.svg" alt="" width={20} height={20} className="h-5 w-5 brightness-0 invert" aria-hidden="true" />
                Patreon
              </Link>
              <a
                href={APPLE_PODCASTS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#9933CC] px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
              >
                <Image src="/apple-podcasts-icon.svg" alt="" width={20} height={20} className="h-5 w-5 brightness-0 invert" aria-hidden="true" />
                Apple Podcasts
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          EPISODES
         ════════════════════════════════════════════════ */}
      {episodes.length > 0 ? (
        <section className="py-12 md:py-16">
          <EpisodesBrowser
            episodes={episodes}
            showSearch={false}
            initialCount={9}
            loadMoreCount={9}
            featuredDesktopTextLarger
            showFeaturedTaxonomyChips
            middleSlot={
              <section className="full-bleed relative overflow-hidden bg-carnival-ink py-16 md:py-24">
                <div className="pointer-events-none absolute inset-0" aria-hidden="true">
                  <div className="absolute -left-20 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-carnival-red/20 blur-[120px]" />
                  <div className="absolute -right-20 top-1/3 h-60 w-60 rounded-full bg-carnival-gold/15 blur-[100px]" />
                </div>
                <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-10 px-4 text-center">
                  <div>
                    <span className="inline-block rounded-full bg-carnival-red px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white">
                      The Compendium Podcast
                    </span>
                    <h2 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">
                      We&apos;re Hiring
                    </h2>
                    <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-white/75">
                      Due to a mysterious surplus in budget, we&apos;re expanding the circus — and we&apos;re
                      looking for fresh recruits to join the Compendium universe. Pick a role, submit your
                      application, and you could be featured on the show.
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      <Link
                        href="/jobs"
                        className="inline-flex items-center gap-2 rounded-full bg-carnival-red px-7 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
                      >
                        Find a Job &rarr;
                      </Link>
                      <Link
                        href="/my-job"
                        className="inline-flex items-center gap-2 rounded-full border-2 border-white/30 bg-white/10 px-7 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg backdrop-blur transition hover:bg-white/20"
                      >
                        I Have a Job
                      </Link>
                    </div>
                  </div>
                </div>
              </section>
            }
          />
        </section>
      ) : null}

      {/* ════════════════════════════════════════════════
          THE HOSTS
         ════════════════════════════════════════════════ */}
      <section className="full-bleed bg-carnival-gold py-14 md:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="mb-10 text-3xl font-black text-carnival-ink md:text-4xl">The Hosts</h2>
          <div className="grid gap-10 md:grid-cols-2">
            {/* Kyle */}
            <div className="text-center">
              <div className="mx-auto aspect-[1080/1571] w-full max-w-[280px] overflow-hidden rounded-xl border-4 border-carnival-red/70 bg-carnival-red/10 shadow-xl">
                <Image
                  src="/Kyle.webp"
                  alt="Kyle Risi — host of The Compendium Podcast"
                  width={1080}
                  height={1571}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <span className="mt-4 inline-block rounded bg-carnival-red px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white">
                Your Ringmaster
              </span>
              <h3 className="mt-2 text-2xl font-black text-carnival-ink">Kyle Risi</h3>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-carnival-ink/85">
                Hey, I&apos;m Kyle, your host on The Compendium podcast. I believe you don&apos;t
                need to commit to a 10-part series to learn about a story. That&apos;s why I&apos;m
                committed to providing easily digestible stories wrapped up in a neat little
                one-hour-ish package.
              </p>
            </div>
            {/* Adam */}
            <div className="text-center">
              <div className="mx-auto aspect-[1080/1571] w-full max-w-[280px] overflow-hidden rounded-xl border-4 border-carnival-teal/70 bg-carnival-teal/10 shadow-xl">
                <Image
                  src="/Adam.webp"
                  alt="Adam Cox — co-host of The Compendium Podcast"
                  width={1080}
                  height={1571}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <span className="mt-4 inline-block rounded bg-carnival-teal px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white">
                Co-Host
              </span>
              <h3 className="mt-2 text-2xl font-black text-carnival-ink">Adam Cox</h3>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-carnival-ink/85">
                I&apos;m Adam Cox, your side-show freak co-pilot on The Compendium. Think of me as
                your voice. Whether on your commute, at the gym, or during quiet moments. Join Kyle
                and me as we dive into mysterious, fascinating, and oddball topics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          LISTENER REVIEWS
         ════════════════════════════════════════════════ */}
      <ReviewsSection reviews={reviews} totalCount={reviewCount} />

      {/* ════════════════════════════════════════════════
          SUBSCRIBE CTA
         ════════════════════════════════════════════════ */}
      <section className="full-bleed relative -mb-8 overflow-hidden bg-carnival-teal py-16 md:py-24">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-carnival-gold/10 blur-[160px]" />
        </div>
        <div className="relative mx-auto max-w-2xl px-4 text-center">
          <h2 className="text-3xl font-black text-white sm:text-4xl">Never Miss an Episode</h2>
          <p className="mx-auto mt-3 max-w-md text-base text-white/70">
            Follow The Compendium on your favourite platform and get notified whenever a new episode drops.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href={SPOTIFY_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#1DB954] px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              Spotify
            </a>
            <Link
              href={PATREON_INTERNAL_PATH}
              className="inline-flex items-center gap-2 rounded-full bg-carnival-red px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
            >
              <Image src="/patreon-icon.svg" alt="" width={20} height={20} className="h-5 w-5 brightness-0 invert" aria-hidden="true" />
              Patreon
            </Link>
            <a
              href={APPLE_PODCASTS_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-[#9933CC] px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:brightness-110"
            >
              <Image src="/apple-podcasts-icon.svg" alt="" width={20} height={20} className="h-5 w-5 brightness-0 invert" aria-hidden="true" />
              Apple Podcasts
            </a>
          </div>
        </div>
      </section>


    </>
  );
}
