import { NextRequest } from 'next/server';
import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { createBlogPost, listBlogPostsAdmin, normalizePageNumber } from '@/lib/blog/data';

function parsePageSize(rawValue: string | null): number {
  if (!rawValue) return 20;
  const value = rawValue.trim();
  if (!/^\d+$/.test(value)) return 20;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : 20;
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);

    const q = req.nextUrl.searchParams.get('q') || '';
    const status = req.nextUrl.searchParams.get('status') || '';
    const page = normalizePageNumber(req.nextUrl.searchParams.get('page'));
    const pageSize = parsePageSize(req.nextUrl.searchParams.get('pageSize'));
    const categoryId = req.nextUrl.searchParams.get('categoryId') || '';
    const sort = req.nextUrl.searchParams.get('sort') === 'updated' ? 'updated' : 'published';
    const data = await listBlogPostsAdmin({ q, status, page, pageSize, categoryId, sort });
    return ok(data);
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to load posts.'), 500);
  }
}

export async function POST() {
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);

    const post = await createBlogPost();
    return ok(post, 201);
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to create post.'), 500);
  }
}
