import { NextRequest } from 'next/server';
import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { listPublishedBlogPostsFeed } from '@/lib/blog/data';

export const revalidate = 300;

function parseStrictInteger(raw: string | null): number | null {
  if (raw == null) return null;
  const value = raw.trim();
  if (!/^-?\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function GET(req: NextRequest) {
  try {
    const limitRaw = req.nextUrl.searchParams.get('limit');
    const offsetRaw = req.nextUrl.searchParams.get('offset');
    const categorySlugRaw = req.nextUrl.searchParams.get('categorySlug');

    const parsedLimit = limitRaw == null ? 6 : parseStrictInteger(limitRaw);
    const parsedOffset = offsetRaw == null ? 0 : parseStrictInteger(offsetRaw);
    const categorySlug = categorySlugRaw?.trim() || undefined;

    if (parsedLimit == null || parsedLimit < 1 || parsedLimit > 12) {
      return badRequest('Query parameter "limit" must be an integer between 1 and 12.');
    }

    if (parsedOffset == null || parsedOffset < 0) {
      return badRequest('Query parameter "offset" must be an integer greater than or equal to 0.');
    }

    const feed = await listPublishedBlogPostsFeed({
      limit: parsedLimit,
      offset: parsedOffset,
      categorySlug
    });

    return ok({
      items: feed.items,
      nextOffset: feed.nextOffset,
      hasMore: feed.hasMore
    });
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to load blog posts.'), 500);
  }
}
