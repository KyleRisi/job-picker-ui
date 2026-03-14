import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BlogPostCard } from '@/components/blog/blog-post-card';
import { CompactPagination } from '@/components/compact-pagination';
import { CompactEpisodeRow, EpisodeCard } from '@/components/episodes-browser';
import { JoinPatreonCta } from '@/components/join-patreon-cta';
import { listAuthorArchive } from '@/lib/blog/data';
import { getResolvedEpisodes } from '@/lib/episodes';
import { createSupabaseAdminClient } from '@/lib/supabase';

export const revalidate = 300;

type Params = {
  authorSlug: string;
};

type SearchParams = {
  tab?: string | string[];
  page?: string | string[];
  view?: string | string[];
};

const EPISODES_PAGE_SIZE = 12;

function isMissingRelationError(error: unknown) {
  const code = `${(error as { code?: string })?.code || ''}`;
  return code === 'PGRST205' || code === '42P01';
}

function resolveAuthorHeroImage(slug: string, name: string, fallbackImageUrl: string | null) {
  const normalizedSlug = `${slug || ''}`.trim().toLowerCase();
  const normalizedName = `${name || ''}`.trim().toLowerCase();

  if (normalizedSlug === 'kyle-risi' || normalizedSlug === 'kyle' || normalizedName === 'kyle risi' || normalizedName === 'kyle') {
    return '/Kyle-meet-the-team.svg';
  }

  if (normalizedSlug === 'adam-cox' || normalizedSlug === 'adam' || normalizedName === 'adam cox' || normalizedName === 'adam') {
    return '/Adam-meet-the-team.svg';
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

async function loadAuthorArchive(authorSlug: string) {
  const normalized = `${authorSlug || ''}`.trim().toLowerCase();
  const primary = await listAuthorArchive(normalized, 1);
  if (primary) return primary;

  const fallback = normalized.split('-')[0]?.trim();
  if (!fallback || fallback === normalized) return null;
  return listAuthorArchive(fallback, 1);
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
    alternates: {
      canonical: `/author/${params.authorSlug}`
    }
  };
}

export default async function AuthorHubPage({
  params,
  searchParams
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const archive = await loadAuthorArchive(params.authorSlug);
  if (!archive) notFound();

  const supabase = createSupabaseAdminClient();
  let episodeIds: string[] = [];

  try {
    const { data, error } = await supabase
      .from('podcast_episode_editorial')
      .select('episode_id')
      .eq('author_id', archive.author.id);

    if (error) throw error;
    episodeIds = Array.from(new Set((data || []).map((row: { episode_id: string | null }) => row.episode_id).filter(Boolean) as string[]));
  } catch (error) {
    if (!isMissingRelationError(error)) throw error;
  }

  const episodes = episodeIds.length
    ? await getResolvedEpisodes({
        ids: episodeIds,
        includeHidden: false,
        descriptionMaxLength: 220
      })
    : [];

  const blogs = archive.items;
  const episodesCount = episodes.length;
  const blogsCount = archive.pagination.total;
  const totalCount = episodesCount + blogsCount;
  const tabValue = Array.isArray(searchParams.tab) ? searchParams.tab[0] : searchParams.tab;
  const activeTab = tabValue === 'blogs' ? 'blogs' : 'episodes';
  const viewValue = Array.isArray(searchParams.view) ? searchParams.view[0] : searchParams.view;
  const activeEpisodeView = viewValue === 'grid' ? 'grid' : 'compact';
  const pageValueRaw = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const pageValue = Number.parseInt(`${pageValueRaw || '1'}`, 10);
  const requestedPage = Number.isFinite(pageValue) && pageValue > 0 ? pageValue : 1;
  const episodeTotalPages = Math.max(1, Math.ceil(episodesCount / EPISODES_PAGE_SIZE));
  const currentEpisodePage = Math.min(requestedPage, episodeTotalPages);
  const episodePageStart = (currentEpisodePage - 1) * EPISODES_PAGE_SIZE;
  const pagedEpisodes = episodes.slice(episodePageStart, episodePageStart + EPISODES_PAGE_SIZE);
  const heroImageUrl = resolveAuthorHeroImage(archive.author.slug, archive.author.name, archive.author.image_url || null);
  const instagramUrl = resolveInstagramUrl(archive.author.slug, archive.author.name);
  const episodePageHref = (page: number) => {
    const params = new URLSearchParams();
    params.set('tab', 'episodes');
    if (page > 1) params.set('page', `${page}`);
    if (activeEpisodeView === 'grid') params.set('view', 'grid');
    const query = params.toString();
    return `/author/${archive.author.slug}${query ? `?${query}` : ''}`;
  };
  const episodeViewHref = (view: 'grid' | 'compact') => {
    const params = new URLSearchParams();
    params.set('tab', 'episodes');
    if (currentEpisodePage > 1) params.set('page', `${currentEpisodePage}`);
    if (view === 'grid') params.set('view', 'grid');
    const query = params.toString();
    return `/author/${archive.author.slug}${query ? `?${query}` : ''}`;
  };

  return (
    <section className="-mb-8 space-y-0">
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
                  href={episodeViewHref(activeEpisodeView)}
                  className={`inline-flex h-10 items-center justify-center rounded-full border px-6 text-base font-black tracking-tight transition ${
                    activeTab === 'episodes'
                      ? 'border-carnival-red bg-carnival-red text-white'
                      : 'border-white/25 bg-transparent text-white/85 hover:bg-white/10'
                  }`}
                >
                  Episodes
                </Link>
                <Link
                  href={`/author/${archive.author.slug}?tab=blogs`}
                  className={`inline-flex h-10 items-center justify-center rounded-full border px-6 text-base font-black tracking-tight transition ${
                    activeTab === 'blogs'
                      ? 'border-carnival-red bg-carnival-red text-white'
                      : 'border-white/25 bg-transparent text-white/85 hover:bg-white/10'
                  }`}
                >
                  Blogs
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-8">
        {activeTab === 'blogs' ? (
          blogs.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {blogs.map((post) => (
                <BlogPostCard key={post.id} post={post} compact />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-carnival-ink/15 bg-white p-5 text-carnival-ink/70">No blogs are assigned to this author yet.</p>
          )
        ) : pagedEpisodes.length ? (
          <div className="space-y-3">
            <div className="flex justify-end">
              <div className="flex items-center gap-1 rounded-lg border border-carnival-ink/15 bg-white p-1" role="radiogroup" aria-label="View mode">
                <Link
                  href={episodeViewHref('grid')}
                  role="radio"
                  aria-checked={activeEpisodeView === 'grid'}
                  aria-label="Grid view"
                  className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                    activeEpisodeView === 'grid' ? 'bg-carnival-ink text-white' : 'text-carnival-ink/50 hover:text-carnival-ink'
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                  </svg>
                </Link>
                <Link
                  href={episodeViewHref('compact')}
                  role="radio"
                  aria-checked={activeEpisodeView === 'compact'}
                  aria-label="Compact list view"
                  className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                    activeEpisodeView === 'compact' ? 'bg-carnival-ink text-white' : 'text-carnival-ink/50 hover:text-carnival-ink'
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </Link>
              </div>
            </div>

            {activeEpisodeView === 'grid' ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {pagedEpisodes.map((episode) => (
                  <EpisodeCard key={episode.id} episode={episode} featured={false} />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {pagedEpisodes.map((episode) => (
                  <CompactEpisodeRow key={episode.id} episode={episode} />
                ))}
              </div>
            )}
            {episodeTotalPages > 1 ? (
              <CompactPagination
                page={currentEpisodePage}
                totalPages={episodeTotalPages}
                hrefForPage={episodePageHref}
                ariaLabel="Episodes pagination"
                className="pt-4"
              />
            ) : null}
          </div>
        ) : (
          <p className="rounded-xl border border-carnival-ink/15 bg-white p-5 text-carnival-ink/70">No episodes are assigned to this author yet.</p>
        )}
      </section>

      <div className="pt-8">
        <JoinPatreonCta />
      </div>
    </section>
  );
}
