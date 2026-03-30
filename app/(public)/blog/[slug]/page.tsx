import type { Metadata } from 'next';
import { listPublishedBlogSlugParams, renderBlogPostPage, resolveBlogPostMetadata, type BlogSlugParams } from './shared';

export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  return listPublishedBlogSlugParams();
}

export async function generateMetadata({ params }: { params: BlogSlugParams }): Promise<Metadata> {
  return resolveBlogPostMetadata(params.slug, false);
}

export default async function BlogPostPage({ params }: { params: BlogSlugParams }) {
  return renderBlogPostPage(params, {
    includeDraft: false,
    resolveLegacyRedirectOnMissing: true
  });
}
