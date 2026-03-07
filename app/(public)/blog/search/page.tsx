import type { Metadata } from 'next';
import { BlogListingPage } from '@/components/blog/blog-listing-page';
import { normalizePageNumber, searchBlogPosts } from '@/lib/blog/data';
import { ROBOTS_NOINDEX_FOLLOW } from '@/lib/seo';

export const metadata: Metadata = {
  title: 'Blog Search',
  robots: ROBOTS_NOINDEX_FOLLOW,
  alternates: { canonical: '/blog/search' }
};

export default async function BlogSearchPage({
  searchParams
}: {
  searchParams: { q?: string; page?: string };
}) {
  const q = searchParams.q || '';
  const page = normalizePageNumber(searchParams.page);
  const results = q ? await searchBlogPosts(q, page) : { items: [], pagination: { page: 1, totalPages: 1 } };
  return (
    <BlogListingPage
      title={q ? `Search results for "${q}"` : 'Search the blog'}
      description={q ? 'Relevant posts across titles, content, taxonomy, and linked episodes.' : 'Use the search box to find blog posts, topics, and episode companions.'}
      posts={results.items}
      pagination={results.pagination as { page: number; totalPages: number }}
      basePath={`/blog/search?q=${encodeURIComponent(q)}`}
    />
  );
}
