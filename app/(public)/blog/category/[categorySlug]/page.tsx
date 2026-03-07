import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { BlogListingPage } from '@/components/blog/blog-listing-page';
import { listTaxonomyArchive, normalizePageNumber } from '@/lib/blog/data';

export const revalidate = 300;

export async function generateMetadata({ params }: { params: { categorySlug: string } }): Promise<Metadata> {
  const archive = await listTaxonomyArchive('categories', params.categorySlug);
  const name = archive?.term?.name || params.categorySlug;
  return {
    title: `Category: ${name}`,
    alternates: { canonical: `/blog/category/${params.categorySlug}` }
  };
}

export default async function BlogCategoryPage({ params, searchParams }: { params: { categorySlug: string }; searchParams: { page?: string } }) {
  const archive = await listTaxonomyArchive('categories', params.categorySlug, normalizePageNumber(searchParams.page));
  if (!archive) notFound();
  return (
    <BlogListingPage
      title={archive.term.name}
      description={archive.term.description || 'Posts in this category.'}
      posts={archive.items}
      pagination={archive.pagination}
      basePath={`/blog/category/${archive.term.slug}`}
    />
  );
}
