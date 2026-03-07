import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { getBlogPostAdminById, restoreBlogRevision } from '@/lib/blog/data';
import { isUuid } from '@/lib/blog/validation';

export async function POST(_req: Request, { params }: { params: { id: string; revisionId: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid post id.');
  if (!isUuid(params.revisionId)) return badRequest('Invalid revision id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    const existingPost = await getBlogPostAdminById(params.id);
    if (!existingPost) return badRequest('Post not found.', 404);
    if (!existingPost.revisions.some((revision: { id: string }) => revision.id === params.revisionId)) {
      return badRequest('Revision not found.', 404);
    }
    const restored = await restoreBlogRevision(params.id, params.revisionId);
    return ok(restored);
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to restore revision.'), 500);
  }
}
