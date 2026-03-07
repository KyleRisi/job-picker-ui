import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BlogListingPage } from '@/components/blog/blog-listing-page';
import { listTaxonomyArchive, normalizePageNumber } from '@/lib/blog/data';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { topicSlug: string } }): Promise<Metadata> {
  const archive = await listTaxonomyArchive('topic_clusters', params.topicSlug);
  const name = archive?.term?.name || params.topicSlug;
  return {
    title: `Topic: ${name}`,
    alternates: { canonical: `/blog/topic/${params.topicSlug}` }
  };
}

export default async function BlogTopicPage({ params, searchParams }: { params: { topicSlug: string }; searchParams: { page?: string } }) {
  const archive = await listTaxonomyArchive('topic_clusters', params.topicSlug, normalizePageNumber(searchParams.page));
  if (!archive) notFound();
  return (
    <BlogListingPage
      title={archive.term.name}
      description={archive.term.description || 'Topic cluster archive.'}
      posts={archive.items}
      pagination={archive.pagination}
      basePath={`/blog/topic/${archive.term.slug}`}
    />
  );
}
