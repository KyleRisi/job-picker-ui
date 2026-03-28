import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BlogListingPage } from '@/components/blog/blog-listing-page';
import { listAuthorArchive } from '@/lib/blog/data';
import { buildCanonicalAndSocialMetadata } from '@/lib/seo-metadata';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { authorSlug: string } }): Promise<Metadata> {
  const archive = await listAuthorArchive(params.authorSlug);
  const name = archive?.author?.name || params.authorSlug;
  const title = `Author: ${name}`;
  const description = archive?.author?.bio || `Read posts by ${name} on The Compendium Podcast blog.`;
  return {
    title,
    description,
    ...buildCanonicalAndSocialMetadata({
      title,
      description,
      twitterTitle: title,
      twitterDescription: description,
      canonicalCandidate: `/blog/author/${params.authorSlug}`,
      fallbackPath: `/blog/author/${params.authorSlug}`,
      openGraphType: 'website',
      imageUrl: '/The Compendium Main.jpg',
      imageAlt: `${name} author archive on The Compendium Podcast blog`
    })
  };
}

export default async function BlogAuthorPage({ params, searchParams }: { params: { authorSlug: string }; searchParams: { page?: string } }) {
  const archive = await listAuthorArchive(params.authorSlug, Number.parseInt(searchParams.page || '1', 10));
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
