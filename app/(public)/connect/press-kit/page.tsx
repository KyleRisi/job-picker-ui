import type { Metadata } from 'next';
import Image from 'next/image';
import { ConnectForm } from '@/components/forms/connect-form';
import { EpisodesGrid } from '@/components/episodes-browser';
import { getPodcastEpisodes, type PodcastEpisode } from '@/lib/podcast';
import { ReviewsSection } from '@/components/reviews-section';
import { getVisibleReviews, getVisibleReviewsCount, type PublicReview } from '@/lib/reviews';
import { TrackedExternalCtaLink } from '@/components/tracked-external-cta-link';

const SPOTIFY_URL = 'https://open.spotify.com/show/30Hh0xbotgbIyCL5tJE4zJ';
const APPLE_PODCASTS_URL = 'https://podcasts.apple.com/gb/podcast/the-compendium-an-assembly-of-fascinating-things/id1676817109';
const PATREON_URL = 'https://www.patreon.com/cw/TheCompendiumPodcast';
const INSTAGRAM_URL = 'https://www.instagram.com/thecompendiumpodcast/';
const YOUTUBE_URL = 'https://www.youtube.com/@CompendiumPodcast';
const YOUTUBE_MUSIC_URL = 'https://music.youtube.com/channel/UCQR5hWsxuu9wh7QvR60qmIw';
const LISTEN_NOTES_URL = 'https://www.listennotes.com/podcasts/the-compendium-an-assembly-of-fascinating-gZiAjURuEF1/';
const PERFORMANCE_STATS_URL = 'https://op3.dev/show/e0002afd25b3436d85a7ea832d2aa3d6';
const BLEAV_URL = 'https://bleav.com/';
const PRESS_PACK_URL = 'https://drive.google.com/drive/folders/1XyXfwOnzz0CU_aWT7xG5ead2k2Egn9Hm?usp=sharing';
const PRESS_RESPONSE_WINDOW = '24-48 hours';

const STARTER_EPISODE_ANGLES = [
  {
    title: 'Princess Diana Part 1',
    angle: 'An accessible entry point into a high-interest global story with strong historical and cultural context.'
  },
  {
    title: 'The Suffolk Strangler',
    angle: 'A research-led true-crime case study with clear chronology, investigative detail, and real-world impact.'
  },
  {
    title: 'Space Cadets',
    angle: 'A lighter cultural-history episode that showcases the show’s range beyond crime and disasters.'
  }
];

export const metadata: Metadata = {
  title: {
    absolute: 'Press Kit | The Compendium Podcast'
  },
  description: 'Official press kit for The Compendium Podcast with show boilerplate, media-ready stats, featured episodes, and press enquiries.',
  alternates: { canonical: '/connect/press-kit' },
  openGraph: {
    title: 'Press Kit | The Compendium Podcast',
    description: 'Official press kit for The Compendium Podcast with show boilerplate, media-ready stats, featured episodes, and press enquiries.',
    url: '/connect/press-kit'
  }
};

function selectStarterEpisodes(episodes: PodcastEpisode[]): PodcastEpisode[] {
  const titleMatchers = [
    { id: 'princess-diana-part-1', matches: ['princess diana part 1', 'princess dianna part 1'] },
    { id: 'the-suffolk-strangler', matches: ['the suffolk strangler', 'suffolk strangler'] },
    { id: 'space-cadets', matches: ['space cadets', 'space cadett', 'space cadetts'] }
  ];

  return titleMatchers
    .map(({ matches }) =>
      episodes.find((episode) => {
        const title = episode.title.toLowerCase();
        return matches.some((term) => title.includes(term));
      })
    )
    .filter((episode): episode is PodcastEpisode => Boolean(episode));
}

export default async function PressKitPage() {
  let starterEpisodes: PodcastEpisode[] = [];
  let reviews: PublicReview[] = [];
  let reviewCount = 0;
  try {
    const [episodes, visibleReviews, visibleReviewsCount] = await Promise.all([
      getPodcastEpisodes({ descriptionMaxLength: 520, limit: 240 }),
      getVisibleReviews(),
      getVisibleReviewsCount()
    ]);
    starterEpisodes = selectStarterEpisodes(episodes);
    reviews = visibleReviews;
    reviewCount = visibleReviewsCount;
  } catch (error) {
    console.error('Failed to load press kit data:', error);
    reviews = await getVisibleReviews();
    reviewCount = reviews.length;
  }

  return (
    <section className="full-bleed relative -mt-8 -mb-8 overflow-hidden bg-carnival-ink pb-14 md:pb-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[72vh] md:h-[78vh]" aria-hidden="true">
        <Image
          src="/kyle-and-adam-hero.jpg"
          alt="Kyle and Adam from The Compendium Podcast"
          fill
          priority
          quality={74}
          className="-translate-y-[60px] object-cover object-[50%_0%] md:translate-y-0 md:object-[50%_-280px]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-carnival-ink/0 via-carnival-ink/25 via-[42%] to-carnival-ink" />
        <div className="absolute inset-x-0 bottom-0 h-[40vh] bg-gradient-to-b from-carnival-ink/0 via-carnival-ink/65 to-carnival-ink md:h-[52vh]" />
        <div className="absolute -left-32 top-[35%] h-96 w-96 rounded-full bg-carnival-red/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-carnival-gold/15 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4">
        <header className="flex min-h-[58vh] items-end pt-20 max-[390px]:min-h-[66vh] max-[390px]:pt-28 md:min-h-[78vh] md:pt-24">
          <div className="pb-12 md:pb-10">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-carnival-gold">The Compendium Podcast</p>
            <h1 className="mt-2 text-4xl font-black leading-tight text-white sm:text-5xl">Press Kit</h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-white/80">
              Media assets, show info, milestone stats, and contact details for interviews and press coverage.
            </p>
          </div>
        </header>

        <div className="-mt-6 space-y-12 md:-mt-8 md:space-y-16">
          <section className="grid gap-8 lg:grid-cols-[340px_1fr] lg:items-start">
            <div className="mx-auto w-full max-w-[360px]">
              <Image
                src="/The Compendium Main.jpg"
                alt="The Compendium Podcast artwork"
                width={720}
                height={720}
                sizes="(max-width: 1024px) 100vw, 360px"
                className="w-full rounded-xl border border-white/20 shadow-card"
              />
            </div>

            <div>
              <p className="inline-flex rounded bg-carnival-red px-2 py-1 text-xs font-black uppercase tracking-[0.08em] text-white">
                Press Resource
              </p>
              <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">Media Boilerplate</h2>
              <p className="mt-4 max-w-4xl text-lg leading-relaxed text-white/85">
                The Compendium Podcast is a weekly variety show hosted by Kyle Risi and Adam Cox, covering true crime, forgotten history, and strange-but-true stories for a global audience.
              </p>
              <p className="mt-3 max-w-4xl text-base leading-relaxed text-white/75">
                Episodes are designed for listeners who want high-context storytelling in a single session, combining research-led scripting with conversational delivery.
              </p>

              <div className="mt-5 grid gap-2 text-sm text-white/80 sm:grid-cols-2">
                <p><span className="font-black text-white">Format:</span> Weekly variety podcast</p>
                <p><span className="font-black text-white">Hosts:</span> Kyle Risi and Adam Cox</p>
                <p><span className="font-black text-white">Genres:</span> True crime, history, unusual real stories</p>
                <p><span className="font-black text-white">Availability:</span> Spotify, Apple Podcasts, Patreon</p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={PRESS_PACK_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full bg-carnival-red px-7 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
                >
                  Download Press Pack
                </a>
                <a
                  href={PERFORMANCE_STATS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-7 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-white/20"
                >
                  View Performance Stats
                </a>
              </div>

              <div className="mt-7">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-white/65">Distribution</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <TrackedExternalCtaLink
                    href={SPOTIFY_URL}
                    target="_blank"
                    destination="spotify"
                    ctaLocation="header"
                    sourcePageType="press_kit"
                    sourcePagePath="/connect/press-kit"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#1DB954] px-5 py-3 text-sm font-black text-white transition hover:brightness-110"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                    </svg>
                    Spotify
                  </TrackedExternalCtaLink>
                  <TrackedExternalCtaLink
                    href={PATREON_URL}
                    target="_blank"
                    destination="patreon"
                    ctaLocation="header"
                    sourcePageType="press_kit"
                    sourcePagePath="/connect/press-kit"
                    className="inline-flex items-center gap-2 rounded-xl bg-carnival-red px-5 py-3 text-sm font-black text-white transition hover:brightness-110"
                  >
                    <Image src="/patreon-icon.svg" alt="" width={20} height={20} className="h-5 w-5 brightness-0 invert" aria-hidden="true" />
                    Patreon
                  </TrackedExternalCtaLink>
                  <TrackedExternalCtaLink
                    href={APPLE_PODCASTS_URL}
                    target="_blank"
                    destination="apple_podcasts"
                    ctaLocation="header"
                    sourcePageType="press_kit"
                    sourcePagePath="/connect/press-kit"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#9933CC] px-5 py-3 text-sm font-black text-white transition hover:brightness-110"
                  >
                    <Image src="/apple-podcasts-icon.svg" alt="" width={20} height={20} className="h-5 w-5 brightness-0 invert" aria-hidden="true" />
                    Apple Podcasts
                  </TrackedExternalCtaLink>
                </div>

                <p className="mt-5 text-xs font-black uppercase tracking-[0.08em] text-white/65">Socials</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <a
                    href={INSTAGRAM_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                  >
                    <Image src="/ig-instagram-icon.svg" alt="" width={18} height={18} className="h-[18px] w-[18px]" aria-hidden="true" />
                    Instagram
                  </a>
                  <TrackedExternalCtaLink
                    href={PATREON_URL}
                    target="_blank"
                    destination="patreon"
                    ctaLocation="header"
                    sourcePageType="press_kit"
                    sourcePagePath="/connect/press-kit"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                  >
                    <Image src="/patreon-icon.svg" alt="" width={18} height={18} className="h-[18px] w-[18px]" aria-hidden="true" />
                    Patreon
                  </TrackedExternalCtaLink>
                  <a
                    href={YOUTUBE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                  >
                    <Image src="/youtube-color-icon.svg" alt="" width={18} height={18} className="h-[18px] w-[18px]" aria-hidden="true" />
                    YouTube
                  </a>
                  <a
                    href={YOUTUBE_MUSIC_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-5 py-3 text-sm font-black text-white transition hover:bg-white/20"
                  >
                    <Image src="/youtube-music-icon.svg" alt="" width={18} height={18} className="h-[18px] w-[18px]" aria-hidden="true" />
                    YouTube Music
                  </a>
                </div>
              </div>
            </div>
          </section>

          <section className="border-t border-white/15 pt-10 md:pt-12">
            <h2 className="text-3xl font-black text-white md:text-4xl">Quick Facts for Press</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Figures below are provided for editorial reference and include source/date context.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <article className="relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-[#c9281e] via-[#ad1f18] to-[#7f110e] p-6 text-center text-white shadow-[0_18px_42px_rgba(0,0,0,0.28)]">
                <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-white/15 blur-3xl" aria-hidden="true" />
                <div className="pointer-events-none absolute -left-8 bottom-0 h-24 w-24 rounded-full bg-carnival-gold/20 blur-2xl" aria-hidden="true" />
                <p className="relative inline-flex rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/90">
                  Audience
                </p>
                <h3 className="relative mt-4 text-[1.95rem] font-black leading-none sm:text-[2.1rem]">575,000</h3>
                <p className="relative mt-3 text-lg font-bold">Total downloads</p>
                <a
                  href={PERFORMANCE_STATS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="relative mt-4 inline-flex rounded-full border border-white/35 bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-white/25"
                >
                  Stats
                </a>
                <p className="relative mt-2 text-[11px] text-white/75">*As of 14 March 2026</p>
              </article>

              <article className="relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-[#be241b] via-[#9d1a14] to-[#6f0f0d] p-6 text-center text-white shadow-[0_18px_42px_rgba(0,0,0,0.28)]">
                <div className="pointer-events-none absolute -right-10 -top-14 h-36 w-36 rounded-full bg-white/12 blur-3xl" aria-hidden="true" />
                <div className="pointer-events-none absolute left-0 top-1/2 h-20 w-20 -translate-y-1/2 rounded-full bg-carnival-gold/15 blur-2xl" aria-hidden="true" />
                <p className="relative inline-flex rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/90">
                  Ranking
                </p>
                <h3 className="relative mt-4 text-[1.95rem] font-black leading-none sm:text-[2.1rem]">Top 1.5%</h3>
                <p className="relative mt-3 text-lg font-bold">Global podcast ranking</p>
                <a
                  href={LISTEN_NOTES_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="relative mt-4 inline-flex rounded-full border border-white/35 bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-white/25"
                >
                  Listen Notes
                </a>
              </article>

              <article className="relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-br from-[#b82219] via-[#951812] to-[#690e0c] p-6 text-center text-white shadow-[0_18px_42px_rgba(0,0,0,0.28)]">
                <div className="pointer-events-none absolute -right-14 top-8 h-40 w-40 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
                <div className="pointer-events-none absolute -left-10 -bottom-8 h-28 w-28 rounded-full bg-carnival-gold/20 blur-2xl" aria-hidden="true" />
                <p className="relative inline-flex rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-white/90">
                  Partnership
                </p>
                <h3 className="relative mt-4 text-[1.95rem] font-black leading-none sm:text-[2.1rem]">Bleav</h3>
                <p className="relative mt-3 text-lg font-bold">Signed to LA-based Podcast Network</p>
                <a
                  href={BLEAV_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="relative mt-4 inline-flex rounded-full border border-white/35 bg-white/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-white/25"
                >
                  Visit Bleav
                </a>
              </article>
            </div>
          </section>

          <section className="border-t border-white/15 pt-10 md:pt-12">
            <h2 className="text-3xl font-black text-white md:text-4xl">Starter Episodes for Coverage</h2>
            <p className="mt-3 max-w-5xl text-base leading-relaxed text-white/80">
              These three episodes are recommended for first-time coverage because they represent the show&apos;s narrative range, editorial style, and audience appeal.
            </p>

            {starterEpisodes.length > 0 ? (
              <div className="mt-6">
                <EpisodesGrid episodes={starterEpisodes} className="grid gap-5 md:grid-cols-2 xl:grid-cols-3" />
              </div>
            ) : (
              <p className="mt-5 rounded-xl border border-white/20 bg-white/5 p-4 text-sm font-semibold text-white/80">
                We couldn&apos;t load the starter-kit episodes right now. Please try again shortly.
              </p>
            )}

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {STARTER_EPISODE_ANGLES.map((item) => (
                <article key={item.title} className="rounded-lg border border-white/20 bg-white/5 p-4">
                  <h3 className="text-sm font-black text-white">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/75">{item.angle}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="border-t border-white/15 pt-10 md:pt-12">
            <h2 className="mb-3 text-3xl font-black text-white md:text-4xl">Interview Hosts</h2>
            <p className="max-w-4xl text-base leading-relaxed text-white/80">
              Both hosts are available for interview requests, written quotes, and background contributions related to episode research, storytelling process, and editorial framing.
            </p>
            <div className="mt-8 grid gap-10 md:grid-cols-2">
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
                  Host
                </span>
                <h3 className="mt-2 text-2xl font-black text-white">Kyle Risi</h3>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/85">
                  Lead host and storyteller, focused on narrative structure and audience-first scripting that distills complex stories into clear, interview-ready context.
                </p>
              </div>

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
                <h3 className="mt-2 text-2xl font-black text-white">Adam Cox</h3>
                <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/85">
                  Co-host and research voice, contributing sourcing, contextual verification, and editorial balance across true-crime and historical storylines.
                </p>
              </div>
            </div>
          </section>

          <section className="border-t border-white/15 pt-10 md:pt-12">
            <p className="mb-4 text-sm font-semibold text-white/70">
              Recent publicly submitted listener feedback.
            </p>
            <ReviewsSection
              reviews={reviews}
              totalCount={reviewCount}
              heading="Audience Reception"
              ariaLabel="Audience reception"
              ctaLabel="Read More Reviews"
              sectionClassName="py-0"
              headingClassName="text-3xl font-black text-white md:text-4xl"
              loadMoreCount={3}
            />
          </section>

          <section className="border-t border-white/15 pt-10 md:pt-12">
            <h2 className="text-3xl font-black text-white md:text-4xl">Press Enquiries</h2>
            <p className="mt-3 max-w-4xl text-base leading-relaxed text-white/80">
              For interviews, media requests, quote approvals, or asset needs, submit the form below and select <strong className="text-white">Press / media</strong>.
              Our team aims to respond within {PRESS_RESPONSE_WINDOW}.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={PRESS_PACK_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full bg-carnival-red px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
              >
                Download Press Pack
              </a>
              <a
                href={PERFORMANCE_STATS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-white/20"
              >
                View Performance Stats
              </a>
            </div>
            <div className="mt-8 mx-auto w-full max-w-4xl">
              <ConnectForm />
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
