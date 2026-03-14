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
    jobs = await getJobsForPublic();
  } catch (error) {
    loadError = 'Could not load jobs right now.';
    console.error('Workspace jobs failed to load:', error);
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Jobs</h1>
        <p className="text-sm text-slate-600">All jobs from the database.</p>
      </header>

      {loadError ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>
      ) : null}

      <WorkspaceJobsTable jobs={jobs} />
    </section>
  );
}
