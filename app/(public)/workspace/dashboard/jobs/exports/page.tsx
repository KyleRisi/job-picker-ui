import { unstable_noStore as noStore } from 'next/cache';
import { WorkspaceJobsExportsPanel } from '@/components/workspace/workspace-jobs-exports-panel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function WorkspaceJobsExportsPage() {
  noStore();

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Jobs Exports</h1>
        <p className="text-sm text-slate-600">Download hiring CSV exports and upload edited active roles to apply bulk updates.</p>
      </header>

      <WorkspaceJobsExportsPanel />
    </section>
  );
}

