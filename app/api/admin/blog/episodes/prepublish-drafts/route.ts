import { NextRequest } from 'next/server';
import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { createPrepublishDraft, listPrepublishDrafts } from '@/lib/episode-prepublish-drafts';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);

    const q = `${req.nextUrl.searchParams.get('q') || ''}`.trim();
    const includeArchived = req.nextUrl.searchParams.get('includeArchived') === 'true';
    const items = await listPrepublishDrafts({ q, includeArchived, limit: 500 });
    return ok({ items });
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to load prepublish drafts.'), 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);

    const payload = await req.json().catch(() => ({}));
    const title = `${payload?.title || ''}`.trim() || 'Untitled episode draft';
    const item = await createPrepublishDraft({ title, actor: user.id || null });
    return ok({ item });
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to create prepublish draft.'), 500);
  }
}
