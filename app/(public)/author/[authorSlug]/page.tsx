import type { Metadata } from 'next';
import { unstable_cache } from 'next/cache';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache, Suspense } from 'react';
import { BlogPostCard } from '@/components/blog/blog-post-card';
import { CompactPagination } from '@/components/compact-pagination';
import { CompactEpisodeRow } from '@/components/episodes-browser';
import { JoinPatreonCta } from '@/components/join-patreon-cta';
import { listAuthorArchive } from '@/lib/blog/data';
import { getAuthorEpisodeList, type AuthorEpisodeListItem } from '@/lib/episodes';
import { buildCanonicalAndSocialMetadata } from '@/lib/seo-metadata';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { AuthorHubClient } from './author-hub-client';
import { AuthorHubQueryRenderer } from './author-hub-query-renderer';

export const revalidate = 300;
export const dynamicParams = true;

type Params = {
  authorSlug: string;
};

const EPISODES_PAGE_SIZE = 12;
const AUTHOR_PAGE_REVALIDATE_SECONDS = 300;

function isMissingRelationError(error: unknown) {
  const code = `${(error as { code?: string })?.code || ''}`;
  return code === 'PGRST205' || code === '42P01';
}

function resolveAuthorHeroImage(slug: string, name: string, fallbackImageUrl: string | null) {
  const normalizedSlug = `${slug || ''}`.trim().toLowerCase();
  const normalizedName = `${name || ''}`.trim().toLowerCase();

  if (normalizedSlug === 'kyle-risi' || normalizedSlug === 'kyle' || normalizedName === 'kyle risi' || normalizedName === 'kyle') {
    return '/Kyle-meet-the-team.jpg';
  }

  if (normalizedSlug === 'adam-cox' || normalizedSlug === 'adam' || normalizedName === 'adam cox' || normalizedName === 'adam') {
    return '/Adam-meet-the-team.jpg';
  }

  return fallbackImageUrl;
}

function resolveInstagramUrl(slug: string, name: string) {
  const normalizedSlug = `${slug || ''}`.trim().toLowerCase();
  const normalizedName = `${name || ''}`.trim().toLowerCase();

  if (normalizedSlug === 'kyle-risi' || normalizedSlug === 'kyle' || normalizedName === 'kyle risi' || normalizedName === 'kyle') {
    return 'https://www.instagram.com/kyle_risi/';
  }

  if (normalizedSlug === 'adam-cox' || normalizedSlug === 'adam' || normalizedName === 'adam cox' || normalizedName === 'adam') {
    return 'https://www.instagram.com/aswcox/';
  }

  return null;
}

const getAuthorArchivePageOneCached = unstable_cache(
  async (slug: string) => listAuthorArchive(slug, 1),
  ['author-archive-page-one-v1'],
  { revalidate: AUTHOR_PAGE_REVALIDATE_SECONDS }
);

const getAuthorEpisodeIdsCached = unstable_cache(
  async (authorId: string) => {
    const supabase = createSupabaseAdminClient();
    try {
      const { data, error } = await supabase
        .from('podcast_episode_editorial')
        .select('episode_id')
        .eq('author_id', authorId);

      if (error) throw error;
      return Array.from(new Set((data || []).map((row: { episode_id: string | null }) => row.episode_id).filter(Boolean) as string[])).sort();
    } catch (error) {
      if (isMissingRelationError(error)) return [];
      throw error;
    }
  },
  ['author-episode-ids-v1'],
  { revalidate: AUTHOR_PAGE_REVALIDATE_SECONDS }
);

const getAuthorEpisodeListForAuthorCached = unstable_cache(
  async (episodeIdsKey: string, authorName: string, authorSlug: string) => {
    if (!episodeIdsKey) return [];
    const ids = episodeIdsKey.split(',').filter(Boolean);
    return getAuthorEpisodeList({
      ids,
      descriptionMaxLength: 220,
      authorName,
      authorSlug
    });
  },
  ['author-episode-list-v1'],
  { revalidate: AUTHOR_PAGE_REVALIDATE_SECONDS }
);

const loadAuthorArchive = cache(async (authorSlug: string) => {
  const normalized = `${authorSlug || ''}`.trim().toLowerCase();
  const primary = await getAuthorArchivePageOneCached(normalized);
  if (primary) return primary;

  const fallback = normalized.split('-')[0]?.trim();
  if (!fallback || fallback === normalized) return null;
  return getAuthorArchivePageOneCached(fallback);
});

export async function generateStaticParams() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('blog_authors').select('slug').eq('is_active', true);
  if (error) {
    console.error('[author-page] generateStaticParams failed', error);
    return [];
  }

  const slugs = Array.from(
    new Set(
      (data || [])
        .map((row: { slug: string | null }) => `${row.slug || ''}`.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  return slugs.map((authorSlug) => ({ authorSlug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const archive = await loadAuthorArchive(params.authorSlug);
  const name = archive?.author?.name || params.authorSlug;

  if (!archive) {
    return {
      title: 'Author Not Found | The Compendium Podcast',
      robots: {
        index: false,
        follow: false
      }
    };
  }

  return {
    title: `${name} | Author | The Compendium Podcast`,
    description: archive.author.bio || `Explore episodes and posts by ${name}.`,
    ...buildCanonicalAndSocialMetadata({
      title: `${name} | Author | The Compendium Podcast`,
      description: archive.author.bio || `Explore episodes and posts by ${name}.`,
      twitterTitle: `${name} | Author | The Compendium Podcast`,
      twitterDescription: archive.author.bio || `Explore episodes and posts by ${name}.`,
      canonicalCandidate: `/author/${params.authorSlug}`,
      fallbackPath: `/author/${params.authorSlug}`,
      openGraphType: 'website',
      imageUrl: archive.author.image_url || '/The Compendium Main.jpg',
      imageAlt: `${name} author archive`
    })
  };
}

export default async function AuthorHubPage({ params }: { params: Params }) {
  const archive = await loadAuthorArchive(params.authorSlug);
  if (!archive) notFound();

  const episodeIds = await getAuthorEpisodeIdsCached(archive.author.id);
  const episodes = episodeIds.length
    ? await getAuthorEpisodeListForAuthorCached(episodeIds.join(','), archive.author.name, archive.author.slug)
    : [];
  const episodesCount = episodes.length;

  const blogs = archive.items;
  const blogsCount = archive.pagination.total;
  const totalCount = episodesCount + blogsCount;
  const heroImageUrl = resolveAuthorHeroImage(archive.author.slug, archive.author.name, archive.author.image_url || null);
  const instagramUrl = resolveInstagramUrl(archive.author.slug, archive.author.name);
  const episodeTotalPages = Math.max(1, Math.ceil(episodesCount / EPISODES_PAGE_SIZE));
  const canonicalEpisodes = episodes.slice(0, EPISODES_PAGE_SIZE);

  const buildEpisodesHref = ({ page, view }: { page: number; view: 'grid' | 'compact' }) => {
    const query = new URLSearchParams();
    query.set('tab', 'episodes');
    if (page > 1) query.set('page', `${page}`);
    if (view === 'grid') query.set('view', 'grid');
    return `/author/${archive.author.slug}?${query.toString()}`;
  };

  return (
    <section className="-mb-8 space-y-0" data-author-hub-root="true">
      <Suspense fallback={null}>
        <AuthorHubClient totalEpisodePages={episodeTotalPages} />
      </Suspense>

      <section className="full-bleed relative -mt-8 overflow-hidden bg-carnival-ink text-white">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-carnival-red/25 blur-[120px]" />
          <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-carnival-gold/20 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-14 md:py-16">
          <div className="grid items-center gap-6 md:grid-cols-[320px_1fr]">
            <div className="relative mx-auto h-[320px] w-[320px] overflow-hidden rounded-xl border border-white/20 bg-white/10 md:mx-0">
              {heroImageUrl ? (
                <Image
                  src={heroImageUrl}
                  alt={archive.author.name}
                  fill
                  sizes="320px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center text-sm font-semibold text-white/75">
                  Author image unavailable
                </div>
              )}
            </div>

            <div className="space-y-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-carnival-gold">Author Archive</p>
              <h1 className="text-[36px] font-black leading-tight tracking-tight text-white sm:text-[48px]">{archive.author.name}</h1>
              {archive.author.bio ? <p className="max-w-2xl text-[16px] leading-relaxed text-white/90">{archive.author.bio}</p> : null}

              {instagramUrl ? (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-white hover:text-carnival-gold"
                >
                  <Image src="/ig-instagram-icon.svg" alt="" width={20} height={20} className="h-5 w-5" aria-hidden="true" />
                  Instagram
                </a>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-4 py-1 text-sm font-semibold text-white/90">
                  {totalCount} total
                </span>
                <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-4 py-1 text-sm font-semibold text-white/90">
                  {episodesCount} episodes
                </span>
                <span className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-4 py-1 text-sm font-semibold text-white/90">
                  {blogsCount} blogs
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <Link
                  href={buildEpisodesHref({ page: 1, view: 'compact' })}
                  data-author-tab-link="true"
                  data-author-tab-value="episodes"
                  className="inline-flex h-10 items-center justify-center rounded-full border border-carnival-red bg-carnival-red px-6 text-base font-black tracking-tight text-white transition"
                >
                  Episodes
                </Link>
                <Link
                  href={`/author/${archive.author.slug}?tab=blogs`}
                  data-author-tab-link="true"
                  data-author-tab-value="blogs"
                  className="inline-flex h-10 items-center justify-center rounded-full border border-white/25 bg-transparent px-6 text-base font-black tracking-tight text-white/85 transition hover:bg-white/10"
                >
                  Blogs
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-8" data-author-tab-panel="episodes">
        {episodes.length ? (
          <>
            <div data-author-episodes-canonical="true">
              <div className="space-y-3">
                <div className="flex justify-end">
                  <div className="flex items-center gap-1 rounded-lg border border-carnival-ink/15 bg-white p-1" role="radiogroup" aria-label="View mode">
                    <Link
                      href={buildEpisodesHref({ page: 1, view: 'grid' })}
                      role="radio"
                      aria-checked="false"
                      aria-label="Grid view"
                      className="flex h-7 w-7 items-center justify-center rounded-md text-carnival-ink/50 transition hover:text-carnival-ink"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                      </svg>
                    </Link>
                    <Link
                      href={buildEpisodesHref({ page: 1, view: 'compact' })}
                      role="radio"
                      aria-checked="true"
                      aria-label="Compact list view"
                      className="flex h-7 w-7 items-center justify-center rounded-md bg-carnival-ink text-white transition"
                    >
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                      </svg>
                    </Link>
                  </div>
                </div>

                <div className="space-y-3">
                  {canonicalEpisodes.map((episode) => (
                    <CompactEpisodeRow key={episode.id} episode={episode} />
                  ))}
                </div>
                {episodeTotalPages > 1 ? (
                  <CompactPagination
                    page={1}
                    totalPages={episodeTotalPages}
                    hrefForPage={(nextPage) => buildEpisodesHref({ page: nextPage, view: 'compact' })}
                    ariaLabel="Episodes pagination"
                    className="pt-4"
                  />
                ) : null}
              </div>
            </div>

            <div data-author-episodes-query-region="true">
              <Suspense fallback={null}>
                <AuthorHubQueryRenderer
                  authorSlug={archive.author.slug}
                  episodes={episodes as AuthorEpisodeListItem[]}
                  pageSize={EPISODES_PAGE_SIZE}
                />
              </Suspense>
            </div>
          </>
        ) : (
          <p className="rounded-xl border border-carnival-ink/15 bg-white p-5 text-carnival-ink/70">No episodes are assigned to this author yet.</p>
        )}
      </section>

      <section className="pt-8" data-author-tab-panel="blogs" hidden>
        {blogs.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {blogs.map((post) => (
              <BlogPostCard key={post.id} post={post} compact />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-carnival-ink/15 bg-white p-5 text-carnival-ink/70">No blogs are assigned to this author yet.</p>
        )}
      </section>

      <div className="pt-8">
        <JoinPatreonCta />
      </div>
    </section>
  );
}
