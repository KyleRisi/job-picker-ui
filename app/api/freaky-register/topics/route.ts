import { ok, badRequest } from '@/lib/server';
import { listActiveFreakyTopics } from '@/lib/freaky';

export async function GET() {
  try {
    const items = await listActiveFreakyTopics();
    return ok({ items });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Unable to load active topics.', 500);
  }
}
