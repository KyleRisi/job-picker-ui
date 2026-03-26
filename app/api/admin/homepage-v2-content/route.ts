import { NextRequest } from 'next/server';
import { requireAdminInApi } from '@/lib/api-auth';
import { badRequest, ok } from '@/lib/server';
import { getEpisodesLandingPageData } from '@/lib/episodes';
import { getVisibleReviews } from '@/lib/reviews';
import {
  getHomepageV2Content,
  homepageV2ContentSchema,
  saveHomepageV2Content
} from '@/lib/homepage-v2/content';

async function requireAdmin() {
  const admin = await requireAdminInApi();
  if (!admin) return null;
  return admin;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return badRequest('Forbidden.', 403);

  try {
    const [episodesData, reviews] = await Promise.all([getEpisodesLandingPageData(), getVisibleReviews(8)]);
    const { content, source } = await getHomepageV2Content({
      episodes: episodesData.episodes,
      reviews
    });

    return ok({ content, source });
  } catch (error) {
    console.error('Failed to load homepage v2 content:', error);
    return badRequest('Failed to load homepage V2 content.', 500);
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return badRequest('Forbidden.', 403);

  const payload = await req.json().catch(() => null);
  const parsed = homepageV2ContentSchema.safeParse(payload);
  if (!parsed.success) {
    return badRequest('Invalid homepage V2 content payload.', 400);
  }

  try {
    await saveHomepageV2Content(parsed.data);
    return ok({ message: 'Homepage V2 content updated.', content: parsed.data });
  } catch (error) {
    console.error('Failed to save homepage v2 content:', error);
    return badRequest('Failed to save homepage V2 content.', 500);
  }
}
