import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { getBlogAnalyticsSummary } from '@/lib/blog/data';

export async function GET() {
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    return ok(await getBlogAnalyticsSummary());
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to load analytics summary.'), 500);
  }
}
