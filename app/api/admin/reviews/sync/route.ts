import { badRequest, ok } from '@/lib/server';
import { requireAdminInApi } from '@/lib/api-auth';
import { syncReviewsFromSources } from '@/lib/review-sync';

export async function POST() {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  try {
    const result = await syncReviewsFromSources();
    return ok({
      message: `Sync complete. ${result.inserted} new review(s) added.`,
      ...result
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Review sync failed.', 500);
  }
}
