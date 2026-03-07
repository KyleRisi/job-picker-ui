import { NextRequest } from 'next/server';
import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { normalizePageNumber, searchBlogPosts } from '@/lib/blog/data';

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q') || '';
    const page = normalizePageNumber(req.nextUrl.searchParams.get('page'));
    return ok(await searchBlogPosts(q, page));
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to search blog posts.'), 500);
  }
}
