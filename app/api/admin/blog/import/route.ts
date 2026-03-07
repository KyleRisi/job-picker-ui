import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { getImportJob, listImportJobs } from '@/lib/blog/data';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    if (jobId) {
      const job = await getImportJob(jobId);
      return ok(job);
    }
    const items = await listImportJobs();
    return ok({ items });
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to load import jobs.'), 500);
  }
}
