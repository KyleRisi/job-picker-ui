import { AdminImportManager } from '@/components/blog/admin-import-manager';
import { listImportJobs } from '@/lib/blog/data';

export const dynamic = 'force-dynamic';

export default async function AdminBlogImportPage() {
  const jobs = await listImportJobs();
  return <AdminImportManager initialJobs={jobs} />;
}
