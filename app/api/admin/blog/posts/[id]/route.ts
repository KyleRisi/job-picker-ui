import { NextRequest } from 'next/server';
import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { getBlogPostAdminById, saveBlogPost, softDeleteBlogPost } from '@/lib/blog/data';
import { isUuid } from '@/lib/blog/validation';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid post id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    const post = await getBlogPostAdminById(params.id);
    if (!post) return badRequest('Post not found.', 404);
    return ok(post);
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to load post.'), 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid post id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    const existing = await getBlogPostAdminById(params.id);
    if (!existing) return badRequest('Post not found.', 404);
    const payload = await req.json();
    const post = await saveBlogPost(params.id, payload);
    return ok(post);
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to save post.'), 500);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid post id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    const existing = await getBlogPostAdminById(params.id);
    if (!existing) return badRequest('Post not found.', 404);
    await softDeleteBlogPost(params.id);
    return ok({ message: 'Post deleted.' });
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to delete post.'), 500);
  }
}
