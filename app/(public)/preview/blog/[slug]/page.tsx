import { draftMode } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ROBOTS_NOINDEX_NOFOLLOW } from '@/lib/seo';
import { renderBlogPostPage, resolveBlogPostMetadata, type BlogSlugParams } from '../../../blog/[slug]/shared';

export async function generateMetadata({ params }: { params: BlogSlugParams }): Promise<Metadata> {
  if (!draftMode().isEnabled) {
    return {
      title: 'Preview not available',
      robots: ROBOTS_NOINDEX_NOFOLLOW
    };
  }

  const metadata = await resolveBlogPostMetadata(params.slug, true);
  return {
    ...metadata,
    robots: ROBOTS_NOINDEX_NOFOLLOW
  };
}

export default async function PreviewBlogPostPage({ params }: { params: BlogSlugParams }) {
  if (!draftMode().isEnabled) {
    notFound();
  }

  return renderBlogPostPage(params, {
    includeDraft: true,
    resolveLegacyRedirectOnMissing: false
  });
}
