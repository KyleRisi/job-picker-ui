import { NextRequest } from 'next/server';
import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { isUuid } from '@/lib/blog/validation';
import { listDraftSnapshots } from '@/lib/episode-prepublish-drafts';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid draft id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);

    const items = await listDraftSnapshots(params.id);
    return ok({ items });
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to load draft snapshots.'), 500);
  }
}
