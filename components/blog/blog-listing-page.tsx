'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { CompactPagination } from '@/components/compact-pagination';
import { BlogPostCard } from '@/components/blog/blog-post-card';
import { LiveSearchInput } from '@/components/live-search-input';
import { getStoragePublicUrl } from '@/lib/blog/media-url';
import type { MediaAssetRecord } from '@/lib/blog/data';

type ListingPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  excerpt_auto: string | null;
  published_at: string | null;
  is_featured?: boolean;
  reading_time_minutes: number | null;
  featured_image: MediaAssetRecord | null;
  taxonomies: { categories: Array<{ id: string; name: string; slug: string }> };
  author?: { name: string; slug: string } | null;
};

const FEED_BATCH_SIZE = 6;
const featuredDateFormatter = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC'
});

function postTimestamp(post: ListingPost) {
  if (!post.published_at) return 0;
  const timestamp = Date.parse(post.published_at);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortPostsNewestFirst(a: ListingPost, b: ListingPost) {
  return postTimestamp(b) - postTimestamp(a) || a.title.localeCompare(b.title);
}

function postMatchesSearch(post: ListingPost, normalizedQuery: string) {
  if (!normalizedQuery) return true;
  const searchableParts = [
    post.title,
    post.excerpt || '',
    post.excerpt_auto || '',
    post.author?.name || '',
    ...post.taxonomies.categories.map((category) => category.name)
  ];

  return searchableParts.join(' ').toLowerCase().includes(normalizedQuery);
}

function FeaturedPostSlide({ post }: { post: ListingPost }) {
  const imageUrl = post.featured_image ? getStoragePublicUrl(post.featured_image.storage_path) : null;
  const category = post.taxonomies.categories[0];

  return (
    <article className="min-w-[84%] snap-start sm:min-w-[62%] md:min-w-0">
      <Link
        href={`/blog/${post.slug}`}
        className="group relative block aspect-[4/5] overflow-hidden rounded-2xl border-2 border-carnival-ink/15 bg-carnival-ink/10 shadow-card"
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={post.featured_image?.alt_text_default || post.title}
            fill
            sizes="(max-width: 640px) 84vw, (max-width: 768px) 62vw, (max-width: 1024px) 48vw, 32vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 space-y-2 p-4 sm:p-5">
          {category ? <p className="text-xs font-black uppercase tracking-wide text-white/80">{category.name}</p> : null}
          <h2 className="line-clamp-2 text-xl font-black leading-tight text-white sm:text-2xl">{post.title}</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-white/85">
            {post.published_at ? <span>{featuredDateFormatter.format(new Date(post.published_at))}</span> : null}
            {post.reading_time_minutes ? <span>{post.reading_time_minutes} min read</span> : null}
          </div>
        </div>
      </Link>
    </article>
  );
}

export function BlogListingPage({
  title,
  description,
  posts,
  featuredPosts,
  pagination,
  basePath = '/blog',
  featuredFirst = false,
  hideDescriptionOnMobile = false,
  showHeader = true,
  onDark = false
}: {
  title: string;
  description: string;
  posts: ListingPost[];
  featuredPosts?: ListingPost[];
  pagination: { page: number; totalPages: number; total?: number; pageSize?: number };
  basePath?: string;
  featuredFirst?: boolean;
  hideDescriptionOnMobile?: boolean;
  showHeader?: boolean;
  onDark?: boolean;
}) {
  const useMagazineLayout = featuredFirst;
  const orderedPosts = [...posts].sort(sortPostsNewestFirst);
  const explicitFeatured = (featuredPosts || []).slice().sort(sortPostsNewestFirst);
  const inferredFeatured = orderedPosts.filter((post) => post.is_featured);
  const highlightedPosts = useMagazineLayout
    ? (explicitFeatured.length ? explicitFeatured : inferredFeatured.length ? inferredFeatured : orderedPosts.slice(0, Math.min(3, orderedPosts.length))).slice(0, 6)
    : [];

  const categoryMap = new Map<
    string,
    { name: string; slug: string; posts: ListingPost[]; seen: Set<string>; latestTimestamp: number }
  >();

  for (const post of orderedPosts) {
    const timestamp = postTimestamp(post);
    for (const category of post.taxonomies.categories) {
      const current = categoryMap.get(category.slug) || {
        name: category.name,
        slug: category.slug,
        posts: [],
        seen: new Set<string>(),
        latestTimestamp: timestamp
      };

      if (!current.seen.has(post.id)) {
        current.posts.push(post);
        current.seen.add(post.id);
      }

      current.latestTimestamp = Math.max(current.latestTimestamp, timestamp);
      categoryMap.set(category.slug, current);
    }
  }

  const preferredOrder = [
    'true-crime',
    'history',
    'incredible-people',
    'scams-hoaxes-cons',
    'mysteries-unexplained',
    'pop-culture-entertainment',
    'cults-belief-moral-panics',
    'disasters-survival'
  ];
  const priorityBySlug = new Map(preferredOrder.map((slug, index) => [slug, index]));
  const categoryTabs = [...categoryMap.values()]
    .filter((section) => section.posts.length > 0)
    .map((section) => ({
      name: section.name,
      slug: section.slug,
      posts: section.posts,
      latestTimestamp: section.latestTimestamp
    }))
    .sort((a, b) => {
      const aPriority = priorityBySlug.get(a.slug) ?? Number.MAX_SAFE_INTEGER;
      const bPriority = priorityBySlug.get(b.slug) ?? Number.MAX_SAFE_INTEGER;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return b.latestTimestamp - a.latestTimestamp || a.name.localeCompare(b.name);
    });

  const initialItemsByTab: Record<string, ListingPost[]> = {
    recent: orderedPosts.slice(0, FEED_BATCH_SIZE)
  };
  const initialOffsetsByTab: Record<string, number> = {
    recent: Math.min(FEED_BATCH_SIZE, orderedPosts.length)
  };
  const knownRecentTotal = typeof pagination.total === 'number' ? pagination.total : orderedPosts.length;
  const initialHasMoreByTab: Record<string, boolean> = {
    recent: knownRecentTotal > FEED_BATCH_SIZE
  };

  for (const category of categoryTabs) {
    initialItemsByTab[category.slug] = category.posts.slice(0, FEED_BATCH_SIZE);
    initialOffsetsByTab[category.slug] = Math.min(FEED_BATCH_SIZE, category.posts.length);
    initialHasMoreByTab[category.slug] = category.posts.length >= FEED_BATCH_SIZE;
  }

  const [selectedCategory, setSelectedCategory] = useState<string>('recent');
  const [query, setQuery] = useState('');
  const [itemsByTab, setItemsByTab] = useState<Record<string, ListingPost[]>>(() => initialItemsByTab);
  const [offsetByTab, setOffsetByTab] = useState<Record<string, number>>(() => initialOffsetsByTab);
  const [hasMoreByTab, setHasMoreByTab] = useState<Record<string, boolean>>(() => initialHasMoreByTab);
  const [loadingByTab, setLoadingByTab] = useState<Record<string, boolean>>({});
  const [errorByTab, setErrorByTab] = useState<Record<string, string | null>>({});
  const normalizedQuery = query.trim().toLowerCase();

  function pageUrl(page: number) {
    const separator = basePath.includes('?') ? '&' : '?';
    return `${basePath}${separator}page=${page}`;
  }

  const availableCategorySlugs = new Set(categoryTabs.map((tab) => tab.slug));
  const activeCategory =
    selectedCategory === 'recent' || availableCategorySlugs.has(selectedCategory)
      ? selectedCategory
      : 'recent';
  const activeCategoryLabel =
    activeCategory === 'recent'
      ? 'Recent'
      : categoryTabs.find((tab) => tab.slug === activeCategory)?.name || 'Recent';
  const activeCategoryPosts =
    activeCategory === 'recent'
      ? orderedPosts
      : categoryTabs.find((tab) => tab.slug === activeCategory)?.posts || [];
  const fallbackActivePosts =
    activeCategory === 'recent'
      ? orderedPosts.slice(0, FEED_BATCH_SIZE)
      : categoryTabs.find((tab) => tab.slug === activeCategory)?.posts.slice(0, FEED_BATCH_SIZE) || [];
  const visiblePostsForTab = itemsByTab[activeCategory] || fallbackActivePosts;
  const visiblePosts = normalizedQuery
    ? activeCategoryPosts.filter((post) => postMatchesSearch(post, normalizedQuery))
    : visiblePostsForTab;
  const standardVisiblePosts = normalizedQuery
    ? orderedPosts.filter((post) => postMatchesSearch(post, normalizedQuery))
    : orderedPosts;
  const hasSearchQuery = normalizedQuery.length > 0;
  const hasMoreForActive = hasMoreByTab[activeCategory] || false;
  const loadingForActive = loadingByTab[activeCategory] || false;
  const errorForActive = errorByTab[activeCategory] || null;

  const sectionTitleClass = onDark ? 'text-xl font-black text-white sm:text-2xl' : 'text-xl font-black sm:text-2xl';
  const tabActiveClass = onDark ? 'text-white' : 'text-carnival-ink';
  const tabInactiveClass = onDark ? 'text-white/55 hover:text-white/85' : 'text-carnival-ink/55 hover:text-carnival-ink/80';
  const emptyClass = onDark ? 'text-white/70' : 'text-carnival-ink/70';
  const errorClass = onDark ? 'text-sm text-carnival-gold' : 'text-sm text-carnival-red';
  const moreButtonClass = onDark
    ? 'btn border border-white/25 bg-white/10 px-4 py-2 font-black text-white hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-55'
    : 'btn-secondary disabled:cursor-not-allowed disabled:opacity-55';
  const noResultsMessage = hasSearchQuery ? 'No posts matched that search.' : 'No posts found for this category yet.';

  const searchPanel = (
    <LiveSearchInput
      id="blog-search"
      value={query}
      onChange={setQuery}
      placeholder="Search posts"
      ariaLabel="Search posts"
    />
  );

  async function handleLoadMore() {
    const tabKey = activeCategory;
    if (loadingByTab[tabKey] || !hasMoreByTab[tabKey]) return;

    const requestOffset = offsetByTab[tabKey] ?? (itemsByTab[tabKey]?.length || 0);

    setLoadingByTab((current) => ({ ...current, [tabKey]: true }));
    setErrorByTab((current) => ({ ...current, [tabKey]: null }));

    try {
      const params = new URLSearchParams({
        limit: String(FEED_BATCH_SIZE),
        offset: String(requestOffset)
      });
      if (tabKey !== 'recent') {
        params.set('categorySlug', tabKey);
      }

      const response = await fetch(`/api/blog/posts?${params.toString()}`, { method: 'GET' });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload && typeof payload.error === 'string'
            ? payload.error
            : 'Failed to load additional posts.'
        );
      }

      const fetchedItems = Array.isArray(payload?.items) ? (payload.items as ListingPost[]) : [];
      const nextOffset = typeof payload?.nextOffset === 'number'
        ? payload.nextOffset
        : requestOffset + fetchedItems.length;
      const hasMore = Boolean(payload?.hasMore);

      setItemsByTab((current) => {
        const existing = current[tabKey] || [];
        const existingIds = new Set(existing.map((item) => item.id));
        const merged = [...existing];

        for (const item of fetchedItems) {
          if (!existingIds.has(item.id)) {
            merged.push(item);
            existingIds.add(item.id);
          }
        }

        return {
          ...current,
          [tabKey]: merged
        };
      });
      setOffsetByTab((current) => ({ ...current, [tabKey]: nextOffset }));
      setHasMoreByTab((current) => ({ ...current, [tabKey]: hasMore }));
    } catch (error) {
      const message =
        error && typeof error === 'object' && 'message' in error
          ? String((error as { message?: unknown }).message || '')
          : 'Failed to load additional posts.';
      setErrorByTab((current) => ({
        ...current,
        [tabKey]: message || 'Failed to load additional posts.'
      }));
    } finally {
      setLoadingByTab((current) => ({ ...current, [tabKey]: false }));
    }
  }

  return (
    <section className="space-y-8">
      {showHeader ? (
        <header className="space-y-4">
          <h1 className={`text-4xl font-black ${onDark ? 'text-white' : ''}`}>{title}</h1>
          <p className={`max-w-3xl text-lg ${onDark ? 'text-white/80' : 'text-carnival-ink/75'} ${hideDescriptionOnMobile ? 'hidden sm:block' : ''}`}>
            {description}
          </p>
          {!useMagazineLayout ? searchPanel : null}
        </header>
      ) : null}

      {useMagazineLayout ? (
        <>
          {highlightedPosts.length ? (
            <section>
              <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 pl-4 pr-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-2 md:overflow-visible md:px-0 lg:grid-cols-3">
                {highlightedPosts.map((post) => (
                  <FeaturedPostSlide key={post.id} post={post} />
                ))}
              </div>
            </section>
          ) : null}

          {categoryTabs.length ? (
            <section>
              <div
                role="tablist"
                aria-label="Blog categories"
                className="flex gap-6 overflow-x-auto pb-2 whitespace-nowrap [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === 'recent'}
                  onClick={() => setSelectedCategory('recent')}
                  className={`shrink-0 border-b-2 pb-1 text-base font-semibold transition ${activeCategory === 'recent' ? `${tabActiveClass} border-current` : `${tabInactiveClass} border-transparent`}`}
                >
                  Recent
                </button>
                {categoryTabs.map((category) => (
                  <button
                    key={category.slug}
                    type="button"
                    role="tab"
                    aria-selected={activeCategory === category.slug}
                    onClick={() => setSelectedCategory(category.slug)}
                    className={`shrink-0 border-b-2 pb-1 text-base font-semibold transition ${activeCategory === category.slug ? `${tabActiveClass} border-current` : `${tabInactiveClass} border-transparent`}`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {searchPanel}

          {visiblePosts.length ? (
            <section className="space-y-4">
              <h3 className={sectionTitleClass}>{activeCategoryLabel}</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visiblePosts.map((post) => (
                  <BlogPostCard key={post.id} post={post} compact onDark={onDark} />
                ))}
              </div>

              {errorForActive ? <p className={errorClass}>{errorForActive}</p> : null}

              {!hasSearchQuery && hasMoreForActive ? (
                <div>
                  <button type="button" className={moreButtonClass} onClick={handleLoadMore} disabled={loadingForActive}>
                    {loadingForActive ? 'Loading…' : 'More'}
                  </button>
                </div>
              ) : null}
            </section>
          ) : (
            <p className={emptyClass}>{noResultsMessage}</p>
          )}
        </>
      ) : (
        standardVisiblePosts.length ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {standardVisiblePosts.map((post) => (
              <BlogPostCard key={post.id} post={post} />
            ))}
          </div>
        ) : (
          <p className={emptyClass}>No posts matched that search.</p>
        )
      )}

      {!useMagazineLayout && !hasSearchQuery ? (
        <CompactPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          hrefForPage={pageUrl}
          ariaLabel="Blog pagination"
        />
      ) : null}
    </section>
  );
}
