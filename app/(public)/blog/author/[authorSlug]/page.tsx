import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BlogListingPage } from '@/components/blog/blog-listing-page';
import { listAuthorArchive, normalizePageNumber } from '@/lib/blog/data';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { authorSlug: string } }): Promise<Metadata> {
  const archive = await listAuthorArchive(params.authorSlug);
  const name = archive?.author?.name || params.authorSlug;
  return {
    title: `Author: ${name}`,
    alternates: { canonical: `/blog/author/${params.authorSlug}` }
  };
}

export default async function BlogAuthorPage({ params, searchParams }: { params: { authorSlug: string }; searchParams: { page?: string } }) {
  const archive = await listAuthorArchive(params.authorSlug, normalizePageNumber(searchParams.page));
  if (!archive) notFound();
  return (
    <BlogListingPage
      title={archive.author.name}
      description={archive.author.bio || 'Posts from this author.'}
      posts={archive.items}
      pagination={archive.pagination}
      basePath={`/blog/author/${archive.author.slug}`}
    />
  );
}
