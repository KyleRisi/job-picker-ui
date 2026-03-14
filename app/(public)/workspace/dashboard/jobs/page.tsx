import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { getJobsForPublic } from '@/lib/data';
import { WorkspaceJobsTable } from '@/components/workspace/workspace-jobs-table';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkspaceJobsPage() {
  noStore();

  let jobs: Awaited<ReturnType<typeof getJobsForPublic>> = [];
  let loadError = '';

  try {
    jobs = await getJobsForPublic({ includeFilledApplicationId: true });
  } catch (error) {
    loadError = 'Could not load jobs right now.';
    console.error('Workspace jobs failed to load:', error);
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Jobs</h1>
          <p className="text-sm text-slate-600">All jobs from the database.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/workspace/dashboard/jobs/bulk-import"
            className="inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Bulk Import Jobs
          </Link>
          <Link
            href="/workspace/dashboard/jobs/new"
            className="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add New Job
          </Link>
        </div>
      </header>

      {loadError ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>
      ) : null}

      <WorkspaceJobsTable jobs={jobs} />
    </section>
  );
}
