import { NextRequest } from 'next/server';
import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { getBlogPostAdminById, saveBlogPost } from '@/lib/blog/data';
import { isUuid } from '@/lib/blog/validation';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid post id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    const existing = await getBlogPostAdminById(params.id);
    if (!existing) return badRequest('Post not found.', 404);
    const payload = await req.json();
    const post = await saveBlogPost(params.id, payload, { autosave: true });
    return ok(post);
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to autosave post.'), 500);
  }
}
