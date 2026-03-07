import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BlogListingPage } from '@/components/blog/blog-listing-page';
import { listTaxonomyArchive, normalizePageNumber } from '@/lib/blog/data';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { seriesSlug: string } }): Promise<Metadata> {
  const archive = await listTaxonomyArchive('series', params.seriesSlug);
  const name = archive?.term?.name || params.seriesSlug;
  return {
    title: `Series: ${name}`,
    alternates: { canonical: `/blog/series/${params.seriesSlug}` }
  };
}

export default async function BlogSeriesPage({ params, searchParams }: { params: { seriesSlug: string }; searchParams: { page?: string } }) {
  const archive = await listTaxonomyArchive('series', params.seriesSlug, normalizePageNumber(searchParams.page));
  if (!archive) notFound();
  return (
    <BlogListingPage
      title={archive.term.name}
      description={archive.term.description || 'Series archive.'}
      posts={archive.items}
      pagination={archive.pagination}
      basePath={`/blog/series/${archive.term.slug}`}
    />
  );
}
