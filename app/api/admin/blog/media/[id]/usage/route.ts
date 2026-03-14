import { NextRequest } from 'next/server';
import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { getMediaAssetUsage } from '@/lib/blog/data';
import { isUuid } from '@/lib/blog/validation';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid media asset id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);

    const usage = await getMediaAssetUsage(params.id);
    if (!usage) return badRequest('Media asset not found.', 404);
    return ok(usage);
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to load media usage.'), 500);
  }
}
