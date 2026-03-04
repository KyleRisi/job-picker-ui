import { NextRequest } from 'next/server';
import { badRequest, ok } from '@/lib/server';
import { env } from '@/lib/env';
import { syncReviewsFromSources } from '@/lib/review-sync';

function getAuthToken(req: NextRequest): string {
  const fromHeader = req.headers.get('x-reviews-sync-secret');
  if (fromHeader) return fromHeader;
  const bearer = req.headers.get('authorization') || '';
  if (bearer.toLowerCase().startsWith('bearer ')) return bearer.slice(7).trim();
  return '';
}

export async function POST(req: NextRequest) {
  const expected = env.reviewsSyncSecret;
  if (!expected) return badRequest('REVIEWS_SYNC_SECRET is not configured.', 500);

  const token = getAuthToken(req);
  if (!token || token !== expected) return badRequest('Forbidden.', 403);

  try {
    const result = await syncReviewsFromSources();
    return ok(result);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Review sync failed.', 500);
  }
}
