import { NextRequest } from 'next/server';
import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { updatePodcastEpisode } from '@/lib/blog/data';
import { isUuid } from '@/lib/blog/validation';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isUuid(params.id)) return badRequest('Invalid episode id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    const payload = await req.json();
    const episode = await updatePodcastEpisode(params.id, payload);
    if (!episode) return badRequest('Episode not found.', 404);
    return ok(episode);
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to update episode.'), 500);
  }
}
