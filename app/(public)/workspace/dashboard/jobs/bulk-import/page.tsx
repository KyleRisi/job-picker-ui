import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { WorkspaceJobsBulkImportPanel } from '@/components/workspace/workspace-jobs-bulk-import-panel';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function WorkspaceJobsBulkImportPage() {
  noStore();

  return (
    <section className="space-y-4">
      <Link
        href="/workspace/dashboard/jobs"
        prefetch={false}
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-700 hover:text-slate-900"
      >
        <svg aria-hidden="true" viewBox="0 0 8 12" className="h-3 w-2 fill-current">
          <path d="M7.4 1.4 6 0 0 6l6 6 1.4-1.4L2.8 6z" />
        </svg>
        Back to Jobs
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Bulk Import Jobs</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Use this page to upload multiple jobs in one go. You can import brand-new roles or import existing employees
          directly into filled roles using the correct CSV template.
        </p>
      </header>

      <WorkspaceJobsBulkImportPanel />
    </section>
  );
}
