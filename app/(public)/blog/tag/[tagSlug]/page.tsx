import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BlogListingPage } from '@/components/blog/blog-listing-page';
import { listTaxonomyArchive, normalizePageNumber } from '@/lib/blog/data';
import { ROBOTS_NOINDEX_FOLLOW } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { tagSlug: string } }): Promise<Metadata> {
  const archive = await listTaxonomyArchive('tags', params.tagSlug);
  const name = archive?.term?.name || params.tagSlug;
  return {
    title: `Tag: ${name}`,
    alternates: { canonical: `/blog/tag/${params.tagSlug}` },
    robots: ROBOTS_NOINDEX_FOLLOW
  };
}

export default async function BlogTagPage({ params, searchParams }: { params: { tagSlug: string }; searchParams: { page?: string } }) {
  const archive = await listTaxonomyArchive('tags', params.tagSlug, normalizePageNumber(searchParams.page));
  if (!archive) notFound();
  return (
    <BlogListingPage
      title={`Tag: ${archive.term.name}`}
      description="Browse posts tagged with this keyword."
      posts={archive.items}
      pagination={archive.pagination}
      basePath={`/blog/tag/${archive.term.slug}`}
    />
  );
}
