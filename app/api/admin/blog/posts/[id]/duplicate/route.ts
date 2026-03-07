import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { duplicateBlogPost, getBlogPostAdminById } from '@/lib/blog/data';
import { isUuid } from '@/lib/blog/validation';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid post id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    const existing = await getBlogPostAdminById(params.id);
    if (!existing) return badRequest('Post not found.', 404);

    const post = await duplicateBlogPost(params.id);
    return ok(post, 201);
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to duplicate post.'), 500);
  }
}
