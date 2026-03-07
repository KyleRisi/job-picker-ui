import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { archiveBlogPost, getBlogPostAdminById } from '@/lib/blog/data';
import { isUuid } from '@/lib/blog/validation';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid post id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    const existing = await getBlogPostAdminById(params.id);
    if (!existing) return badRequest('Post not found.', 404);
    const post = await archiveBlogPost(params.id);
    return ok(post);
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to archive post.'), 500);
  }
}
