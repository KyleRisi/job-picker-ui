import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { getBlogPostAdminById, restoreBlogPost } from '@/lib/blog/data';
import { revalidatePublicBlogContent } from '@/lib/blog/revalidate';
import { isUuid } from '@/lib/blog/validation';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid post id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    const existing = await getBlogPostAdminById(params.id);
    if (!existing) return badRequest('Post not found.', 404);
    await restoreBlogPost(params.id);
    revalidatePublicBlogContent({ previous: existing });
    return ok({ message: 'Post restored.' });
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to restore post.'), 500);
  }
}
