import { draftMode } from 'next/headers';
import { NextResponse } from 'next/server';
import { badRequest } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { getBlogPostAdminById } from '@/lib/blog/data';
import { isUuid } from '@/lib/blog/validation';
import { getPublicSiteUrl } from '@/lib/site-url';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid post id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) {
      return NextResponse.redirect(new URL('/workspace/login?error=blog-auth', getPublicSiteUrl()));
    }
    const post = await getBlogPostAdminById(params.id);
    if (!post) {
      return badRequest('Post not found.', 404);
    }
    draftMode().enable();
    return NextResponse.redirect(new URL(`/preview/blog/${post.slug}`, getPublicSiteUrl()));
  } catch {
    return NextResponse.redirect(new URL('/workspace/dashboard/blogs?error=preview-failed', getPublicSiteUrl()));
  }
}
