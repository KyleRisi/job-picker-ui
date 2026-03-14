import { NextRequest } from 'next/server';
import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { listEpisodeSyncLogs, listPodcastEpisodes } from '@/lib/blog/data';
import { syncPodcastEpisodes } from '@/lib/blog/rss-sync';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    const q = req.nextUrl.searchParams.get('q') || '';
    const [items, logs] = await Promise.all([
      listPodcastEpisodes({ q, includeHidden: true }),
      listEpisodeSyncLogs()
    ]);
    return ok({ items, logs });
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to load episodes.'), 500);
  }
}

export async function POST() {
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    // Manual "sync all" keeps current behavior: explicit full overwrite from RSS.
    const result = await syncPodcastEpisodes({ mode: 'full' });
    return ok(result);
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to sync episodes.'), 500);
  }
}
