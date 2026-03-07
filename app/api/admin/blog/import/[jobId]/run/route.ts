import { badRequest, getErrorMessage, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { getImportJob } from '@/lib/blog/data';
import { runWordpressImport } from '@/lib/blog/import-wordpress';
import { isUuid } from '@/lib/blog/validation';

export async function POST(_req: Request, { params }: { params: { jobId: string } }) {
  if (!isUuid(params.jobId)) return badRequest('Invalid import job id.');
  try {
    const user = await requireBlogAdminApiUser();
    if (!user) return badRequest('Unauthorized.', 401);
    const existing = await getImportJob(params.jobId);
    if (!existing) return badRequest('Import job not found.', 404);
    const job = await runWordpressImport(params.jobId);
    return ok(job);
  } catch (error) {
    return badRequest(getErrorMessage(error, 'Failed to run import job.'), 500);
  }
}
