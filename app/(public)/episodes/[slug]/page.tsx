import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { formatEpisodeDate, getPodcastEpisodeBySlug } from '@/lib/podcast';
import { BackButton } from '@/components/back-button';
import { EpisodeMediaPlayer } from '@/components/episode-media-player';
import { getPublicSiteUrl } from '@/lib/site-url';

export const revalidate = 900;

function toMetaDescription(value: string): string {
  const normalized = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Read full details for this podcast episode.';
  return normalized.length > 155 ? `${normalized.slice(0, 152).trimEnd()}...` : normalized;
}

function getSpotifyEpisodeUrl(title: string): string {
  const query = encodeURIComponent(`${title} The Compendium Podcast`);
  return `https://open.spotify.com/search/${query}`;
}

function getApplePodcastsEpisodeUrl(title: string): string {
  const query = encodeURIComponent(`${title} The Compendium Podcast`);
  return `https://podcasts.apple.com/us/search?term=${query}`;
}

type Params = {
  slug: string;
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const episode = await getPodcastEpisodeBySlug(params.slug, {
    includeDescriptionHtml: true,
    descriptionMaxLength: null
  });

  if (!episode) {
    return {
      title: 'Episode Not Found',
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const description = toMetaDescription(episode.description);
  const canonicalPath = `/episodes/${episode.slug}`;

  return {
    title: {
      absolute: `${episode.title} | The Compendium Podcast`
    },
    description,
    alternates: {
      canonical: canonicalPath
    },
    openGraph: {
      title: `${episode.title} | The Compendium Podcast`,
      description,
      url: canonicalPath,
      images: episode.artworkUrl
        ? [
            {
              url: episode.artworkUrl,
              width: 1200,
              height: 1200,
              alt: `Artwork for ${episode.title}`
            }
          ]
        : undefined
    },
    twitter: {
      card: 'summary_large_image',
      title: `${episode.title} | The Compendium Podcast`,
      description,
      images: episode.artworkUrl ? [episode.artworkUrl] : undefined
    }
  };
}

export default async function EpisodeDetailPage({ params }: { params: Params }) {
  const episode = await getPodcastEpisodeBySlug(params.slug, {
    includeDescriptionHtml: true,
    descriptionMaxLength: null
  });

  if (!episode) notFound();

  const siteUrl = getPublicSiteUrl();
  const canonicalUrl = `${siteUrl}/episodes/${episode.slug}`;
  const spotifyUrl = getSpotifyEpisodeUrl(episode.title);
  const applePodcastsUrl = getApplePodcastsEpisodeUrl(episode.title);
  const episodeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'PodcastEpisode',
    url: canonicalUrl,
    name: episode.title,
    datePublished: episode.publishedAt,
    description: episode.description,
    associatedMedia: {
      '@type': 'MediaObject',
      contentUrl: episode.audioUrl
    },
    image: episode.artworkUrl || `${siteUrl}/The Compendium Main.jpg`,
    partOfSeries: {
      '@type': 'PodcastSeries',
      name: 'The Compendium Podcast',
      url: siteUrl
    }
  };

  return (
    <section className="space-y-5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(episodeJsonLd) }}
      />
      <BackButton />

      <article className="overflow-hidden rounded-xl border-2 border-carnival-ink/20 bg-carnival-ink text-white shadow-card">
        <div className="grid gap-5 p-5 md:grid-cols-[340px_1fr] md:p-6">
          <div className="relative aspect-square overflow-hidden rounded-lg border border-white/15 bg-black/25">
            {episode.artworkUrl ? (
              <Image
                src={episode.artworkUrl}
                alt={`Artwork for ${episode.title}`}
                fill
                sizes="(max-width: 768px) calc(100vw - 2.5rem), 340px"
                className="object-cover"
                unoptimized
                priority
                fetchPriority="high"
              />
            ) : (
              <div className="flex h-full items-center justify-center px-6 text-center text-sm font-semibold text-white/80">
                Episode artwork unavailable
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-wide text-white/80">
              <span>{formatEpisodeDate(episode.publishedAt)}</span>
              {episode.episodeNumber !== null ? (
                <span className="rounded-full bg-carnival-red px-2.5 py-1 text-[11px] text-white">Episode {episode.episodeNumber}</span>
              ) : null}
            </div>

            <h1 className="mt-3 text-[1.8rem] font-black leading-tight text-white sm:text-[2.2rem]">{episode.title}</h1>

            <div className="mt-4">
              <EpisodeMediaPlayer
                episode={{
                  slug: episode.slug,
                  title: episode.title,
                  audioUrl: episode.audioUrl,
                  artworkUrl: episode.artworkUrl,
                  episodeNumber: episode.episodeNumber,
                  publishedAt: episode.publishedAt,
                  duration: episode.duration
                }}
              />
            </div>

            <p className="mt-4 text-xs font-black uppercase tracking-wide text-white/80">Listen On</p>
            <div className="mt-2 flex flex-nowrap gap-2">
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-[#1DB954] px-2 py-2 text-xs font-bold text-white transition hover:brightness-110 sm:gap-2 sm:px-3 sm:text-sm"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
                  <path
                    d="M8 10.2c2.8-1 5.7-.8 8.5.6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M8.7 13.1c2.1-.7 4.3-.5 6.2.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.6 15.6c1.5-.4 3-.3 4.3.4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="truncate">Spotify</span>
              </a>

              <a
                href={applePodcastsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-[#D56DFB] px-2 py-2 text-xs font-bold text-white transition hover:brightness-110 sm:gap-2 sm:px-3 sm:text-sm"
              >
                <Image src="/apple-podcasts-icon.svg" alt="" width={16} height={16} className="h-4 w-4 brightness-0 invert" aria-hidden="true" />
                <span className="truncate">Apple Podcasts</span>
              </a>

              <a
                href="https://www.patreon.com/cw/TheCompendiumPodcast"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-carnival-red px-2 py-2 text-xs font-bold text-white transition hover:brightness-110 sm:gap-2 sm:px-3 sm:text-sm"
              >
                <Image src="/patreon-icon.svg" alt="" width={16} height={16} className="h-4 w-4 brightness-0 invert" aria-hidden="true" />
                <span className="truncate">Patreon</span>
              </a>
            </div>
          </div>
        </div>
      </article>

      <article className="rounded-xl border-2 border-carnival-ink/15 bg-white p-5 shadow-card sm:p-6">
        <h2 className="text-xl font-black text-carnival-ink">Episode Description</h2>
        {episode.descriptionHtml ? (
          <div className="episode-rich mt-4 text-base leading-relaxed text-carnival-ink/90" dangerouslySetInnerHTML={{ __html: episode.descriptionHtml }} />
        ) : (
          <div className="mt-4 text-base leading-relaxed text-carnival-ink/90">No episode description available.</div>
        )}
      </article>
    </section>
  );
}
