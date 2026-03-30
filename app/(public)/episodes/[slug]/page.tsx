import Image from 'next/image';
import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { BlogContentRenderer } from '@/components/blog/blog-content-renderer';
import { BlogPostCard } from '@/components/blog/blog-post-card';
import { CompactEpisodeRow } from '@/components/episodes-browser';
import { EpisodeMediaPlayer } from '@/components/episode-media-player';
import { JoinPatreonCta } from '@/components/join-patreon-cta';
import { TrackedExternalCtaLink } from '@/components/tracked-external-cta-link';
import { TrackedPatreonCtaLink } from '@/components/tracked-patreon-cta-link';
import { collectReferencedImageIds } from '@/lib/blog/content';
import { getMediaAssetMapByIds, listBlogAuthors } from '@/lib/blog/data';
import { breadcrumbsToJsonLd } from '@/lib/breadcrumbs';
import {
  buildEpisodeBreadcrumbs,
  formatEpisodeDate,
  listPublishedEpisodeSlugs,
  getResolvedEpisodeBySlug,
  resolveEpisodeSlugRedirect
} from '@/lib/episodes';
import { getPublicSiteUrl } from '@/lib/site-url';
import { PATREON_INTERNAL_PATH } from '@/lib/patreon-links';
import { isTaxonomyPublicDisplayable } from '@/lib/taxonomy-route-policy';
import { resolveEpisodeSummary } from '@/lib/seo-page-copy';
import { buildCanonicalAndSocialMetadata } from '@/lib/seo-metadata';

export const revalidate = 900;
export const dynamicParams = true;

type Params = {
  slug: string;
};

export async function generateStaticParams() {
  const slugs = await listPublishedEpisodeSlugs();
  return slugs.map((slug) => ({ slug }));
}

function getSpotifyEpisodeUrl(title: string): string {
  const query = encodeURIComponent(`${title} The Compendium Podcast`);
  return `https://open.spotify.com/search/${query}`;
}

function getApplePodcastsEpisodeUrl(title: string): string {
  const query = encodeURIComponent(`${title} The Compendium Podcast`);
  return `https://podcasts.apple.com/us/search?term=${query}`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const episode = await getResolvedEpisodeBySlug(params.slug, { includeHidden: false, includeBody: false });

  if (!episode) {
    return {
      title: 'Episode Not Found',
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const pageTitle = episode.seoTitle || episode.title;
  const description = episode.metaDescription || undefined;
  const socialTitle = episode.editorial?.socialTitle || pageTitle;
  const socialDescription = episode.editorial?.socialDescription || description;
  const socialImageUrl = episode.editorial?.socialImageUrl || episode.heroImageUrl || null;
  const socialMetadata = buildCanonicalAndSocialMetadata({
    title: socialTitle,
    description: socialDescription,
    twitterTitle: socialTitle,
    twitterDescription: socialDescription,
    canonicalCandidate: episode.canonicalUrl,
    fallbackPath: `/episodes/${episode.slug}`,
    openGraphType: 'article',
    imageUrl: socialImageUrl,
    imageAlt: `Artwork for ${episode.title}`
  });

  return {
    title: {
      absolute: pageTitle
    },
    description,
    robots: {
      index: !episode.noindex,
      follow: !episode.nofollow
    },
    ...socialMetadata
  };
}

export default async function EpisodeDetailPage({ params }: { params: Params }) {
  let episode = await getResolvedEpisodeBySlug(params.slug, { includeHidden: false, includeBody: true });

  if (!episode) {
    const redirectMatch = await resolveEpisodeSlugRedirect(params.slug);
    if (redirectMatch) {
      permanentRedirect(redirectMatch.targetPath);
    }
    notFound();
  }

  const siteUrl = getPublicSiteUrl();
  const canonicalUrl = `${siteUrl}${episode.canonicalUrl}`;
  const spotifyUrl = getSpotifyEpisodeUrl(episode.title);
  const applePodcastsUrl = getApplePodcastsEpisodeUrl(episode.title);
  const breadcrumbItems = buildEpisodeBreadcrumbs(episode);
  const breadcrumbJsonLd = breadcrumbsToJsonLd(breadcrumbItems, siteUrl);
  const episodeJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'PodcastEpisode',
    url: canonicalUrl,
    name: episode.title,
    datePublished: episode.publishedAt,
    description: episode.metaDescription,
    associatedMedia: {
      '@type': 'MediaObject',
      contentUrl: episode.audioUrl
    },
    image: episode.heroImageUrl || `${siteUrl}/The Compendium Main.jpg`,
    partOfSeries: {
      '@type': 'PodcastSeries',
      name: 'The Compendium Podcast',
      alternateName: 'The Compendium: An Assembly of Fascinating Things',
      url: siteUrl
    }
  };

  const structuredBody = Array.isArray(episode.bodyJson) ? episode.bodyJson : null;
  const structuredBodyWithoutTranscript = structuredBody
    ? structuredBody.filter((block) => block?.type !== 'transcript')
    : [];
  const transcriptOnlyStructuredBlocks = structuredBody
    ? structuredBody.filter((block) => block?.type === 'transcript')
    : [];
  const [assetMap, authors] = await Promise.all([
    structuredBody ? getMediaAssetMapByIds(collectReferencedImageIds(structuredBody)) : Promise.resolve(new Map()),
    listBlogAuthors()
  ]);
  const episodeAuthor = episode.editorial?.authorId
    ? (authors.find((author) => author.id === episode.editorial?.authorId) || null)
    : null;
  const linkedEpisodesForRenderer = [
    {
      is_primary: true,
      episode: {
        id: episode.id,
        rss_guid: '',
        title: episode.source.title,
        slug: episode.source.slug,
        description_plain: episode.source.descriptionPlain,
        description_html: episode.source.descriptionHtml,
        published_at: episode.publishedAt,
        audio_url: episode.audioUrl,
        artwork_url: episode.artworkUrl,
        transcript: episode.transcript,
        show_notes: episode.source.showNotes,
        is_visible: episode.isVisible,
        is_archived: episode.isArchived,
        last_synced_at: episode.source.lastSyncedAt,
        created_at: '',
        updated_at: '',
        episode_number: episode.episodeNumber,
        season_number: episode.seasonNumber,
        duration_seconds: episode.source.durationSeconds,
        source_url: episode.source.sourceUrl,
        missing_from_feed_at: episode.source.missingFromFeedAt
      }
    }
  ];
  const publicDiscoveryChips = episode.discoveryTerms.filter((term) => isTaxonomyPublicDisplayable({
    isActive: term.isActive,
    termType: term.termType,
    slug: term.slug,
    entitySubtype: term.entitySubtype,
    path: term.path
  }));
  const episodeSummary = resolveEpisodeSummary(episode);
  const episodeBodyTextClass = structuredBody && structuredBodyWithoutTranscript.length ? 'text-lg leading-8' : 'text-base leading-relaxed';

  return (
    <section className="-mb-8 space-y-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(episodeJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <section className="full-bleed relative !-mt-8 overflow-hidden bg-carnival-ink text-white">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-carnival-red/30 blur-[120px]" />
          <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-carnival-gold/20 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-10 md:py-14">
          <div className="grid items-start gap-5 lg:grid-cols-[360px_1fr]">
          <div className="relative mx-auto h-[280px] w-[280px] self-start overflow-hidden rounded-lg border border-white/15 bg-black/25 sm:h-[320px] sm:w-[320px] lg:mx-0 lg:h-[360px] lg:w-[360px] lg:max-w-none">
            {episode.heroImageUrl ? (
              <Image
                src={episode.heroImageUrl}
                alt={`Artwork for ${episode.title}`}
                fill
                sizes="(max-width: 639px) 280px, (max-width: 1023px) 320px, 360px"
                className="object-cover"
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
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-black uppercase tracking-wide text-white/80">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span>{formatEpisodeDate(episode.publishedAt)}</span>
                {episode.isFeatured ? <span className="rounded-full bg-carnival-gold px-2.5 py-1 text-[11px] text-carnival-ink">Featured</span> : null}
              </div>
              {episode.episodeNumber !== null ? (
                <span className="ml-auto rounded-full bg-carnival-red px-2.5 py-1 text-[11px] text-white">Episode {episode.episodeNumber}</span>
              ) : null}
            </div>

            <h1 className="mt-3 text-[1.8rem] font-black leading-tight text-white sm:text-[2.2rem]">{episode.title}</h1>
            {episodeAuthor?.name ? (
              <p className="mt-2 text-sm font-semibold text-white/85">
                by{' '}
                {episodeAuthor.slug ? (
                  <Link href={`/author/${episodeAuthor.slug}`} className="text-white transition hover:text-carnival-gold">
                    {episodeAuthor.name}
                  </Link>
                ) : (
                  episodeAuthor.name
                )}
              </p>
            ) : null}

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

            {publicDiscoveryChips.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {publicDiscoveryChips.map((term) => (
                  <Link key={term.id} href={term.path as string} className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-white/85 hover:bg-white/10">
                    {term.name}
                  </Link>
                ))}
              </div>
            ) : null}

            <p className="mt-4 text-xs font-black uppercase tracking-wide text-white/80">Listen On</p>
            <div className="mt-2 flex flex-nowrap gap-2">
              <TrackedExternalCtaLink
                href={spotifyUrl}
                target="_blank"
                destination="spotify"
                ctaLocation="episode_page"
                sourcePageType="episode_page"
                sourcePagePath={episode.canonicalUrl}
                episodeTitle={episode.title}
                episodeSlug={episode.slug}
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-[#1DB954] px-2 py-2 text-xs font-bold text-white transition hover:brightness-110 sm:gap-2 sm:px-3 sm:text-sm"
              >
                <span className="truncate">Spotify</span>
              </TrackedExternalCtaLink>

              <TrackedExternalCtaLink
                href={applePodcastsUrl}
                target="_blank"
                destination="apple_podcasts"
                ctaLocation="episode_page"
                sourcePageType="episode_page"
                sourcePagePath={episode.canonicalUrl}
                episodeTitle={episode.title}
                episodeSlug={episode.slug}
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-[#D56DFB] px-2 py-2 text-xs font-bold text-white transition hover:brightness-110 sm:gap-2 sm:px-3 sm:text-sm"
              >
                <span className="truncate">Apple Podcasts</span>
              </TrackedExternalCtaLink>

              <TrackedPatreonCtaLink
                href={PATREON_INTERNAL_PATH}
                ctaLocation="episode_page"
                sourcePageType="episode_page"
                sourcePagePath={episode.canonicalUrl}
                episodeTitle={episode.title}
                episodeSlug={episode.slug}
                className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-carnival-red px-2 py-2 text-xs font-bold text-white transition hover:brightness-110 sm:gap-2 sm:px-3 sm:text-sm"
              >
                <span className="truncate">Patreon</span>
              </TrackedPatreonCtaLink>
            </div>
          </div>
          </div>
        </div>
      </section>

      {episodeSummary ? (
        <section className="-mx-4 bg-white px-5 pt-5 sm:mx-0 sm:px-6 sm:pt-6">
          <p className={episodeBodyTextClass + ' text-carnival-ink/90'}>{episodeSummary}</p>
        </section>
      ) : null}

      <article className="-mx-4 bg-white px-5 py-5 sm:mx-0 sm:px-6 sm:py-6">
        {structuredBody && structuredBodyWithoutTranscript.length ? (
          <div>
            <BlogContentRenderer
              document={structuredBody}
              assetMap={assetMap}
              linkedEpisodes={linkedEpisodesForRenderer as any}
              relatedPosts={episode.relatedPosts.map((post) => ({ id: post.id, slug: post.slug, title: post.title }))}
            />
          </div>
        ) : episode.bodyHtml ? (
          <>
            <div className="episode-rich mt-4 text-base leading-relaxed text-carnival-ink/90" dangerouslySetInnerHTML={{ __html: episode.bodyHtml }} />
            {transcriptOnlyStructuredBlocks.length ? (
              <div className="mt-6">
                <BlogContentRenderer
                  document={transcriptOnlyStructuredBlocks}
                  assetMap={assetMap}
                  linkedEpisodes={linkedEpisodesForRenderer as any}
                  relatedPosts={episode.relatedPosts.map((post) => ({ id: post.id, slug: post.slug, title: post.title }))}
                />
              </div>
            ) : null}
          </>
        ) : transcriptOnlyStructuredBlocks.length ? (
          <div className="mt-4">
            <BlogContentRenderer
              document={transcriptOnlyStructuredBlocks}
              assetMap={assetMap}
              linkedEpisodes={linkedEpisodesForRenderer as any}
              relatedPosts={episode.relatedPosts.map((post) => ({ id: post.id, slug: post.slug, title: post.title }))}
            />
          </div>
        ) : (
          <div className="mt-4 text-base leading-relaxed text-carnival-ink/90">No episode description available.</div>
        )}
      </article>
      <div className="space-y-6 pt-6">
        {episode.relatedEpisodes.length ? (
          <section>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-black text-carnival-ink">Related Episodes</h2>
            </div>
            <div className="mt-4 space-y-3">
              {episode.relatedEpisodes.map((item) => (
                <CompactEpisodeRow key={`${item.relationshipType}-${item.episode.id}`} episode={item.episode} excerptNoSnippet />
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              <Link
                href="/episodes"
                className="inline-flex h-10 items-center justify-center rounded-md bg-carnival-red px-6 text-sm font-semibold text-white transition hover:brightness-110"
              >
                Browse all episodes
              </Link>
            </div>
          </section>
        ) : null}

        {episode.relatedPosts.length ? (
          <section>
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-black text-carnival-ink">Related Reading</h2>
              <Link href="/blog" className="text-sm font-semibold text-carnival-red underline underline-offset-2">Browse the blog</Link>
            </div>
            <div className="mt-4 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {episode.relatedPosts.map((post) => (
                <BlogPostCard
                  key={post.id}
                  excerptNoSnippet
                  post={{
                    id: post.id,
                    slug: post.slug,
                    title: post.title,
                    excerpt: post.excerpt,
                    excerpt_auto: null,
                    published_at: post.publishedAt,
                    reading_time_minutes: post.readingTimeMinutes,
                    featured_image: post.featuredImage
                      ? {
                          storage_path: post.featuredImage.storagePath,
                          alt_text_default: post.featuredImage.altText
                        }
                      : null,
                    taxonomies: { categories: [] },
                    author: post.author
                  }}
                />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <div className="pt-8">
        <JoinPatreonCta />
      </div>
    </section>
  );
}
