import { revalidatePath } from 'next/cache';

type BlogVisibilityState = {
  slug?: string | null;
  status?: string | null;
  published_at?: string | null;
  deleted_at?: string | null;
};

function normalizeSlug(slug: string | null | undefined): string | null {
  const normalized = slug?.trim();
  return normalized ? normalized : null;
}

function isPublishedNow(post: BlogVisibilityState | null | undefined): boolean {
  if (!post) return false;
  if (post.deleted_at) return false;
  if (post.status !== 'published') return false;
  if (!post.published_at) return false;
  const publishedAt = new Date(post.published_at).getTime();
  if (!Number.isFinite(publishedAt)) return false;
  return publishedAt <= Date.now();
}

export function revalidatePublicBlogContent(input?: {
  previous?: BlogVisibilityState | null;
  current?: BlogVisibilityState | null;
  force?: boolean;
}) {
  const previousSlug = normalizeSlug(input?.previous?.slug);
  const currentSlug = normalizeSlug(input?.current?.slug);
  const slugChanged = Boolean(previousSlug && currentSlug && previousSlug !== currentSlug);
  const shouldRevalidate = Boolean(
    input?.force || slugChanged || isPublishedNow(input?.previous) || isPublishedNow(input?.current)
  );
  if (!shouldRevalidate) return;

  revalidatePath('/blog');
  revalidatePath('/blog/[slug]', 'page');
  revalidatePath('/blog/rss.xml');
  revalidatePath('/sitemap.xml');

  if (previousSlug) revalidatePath(`/blog/${previousSlug}`);
  if (currentSlug) revalidatePath(`/blog/${currentSlug}`);
}
