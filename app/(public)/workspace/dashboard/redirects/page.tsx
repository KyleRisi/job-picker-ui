import { unstable_noStore as noStore } from 'next/cache';
import { WorkspaceRedirectsTable } from '@/components/workspace/workspace-redirects-table';
import { RedirectHeaderActions } from './redirect-header-actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkspaceRedirectsPage() {
  noStore();

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Redirects</h1>
          <p className="text-sm text-slate-600">Manage URL redirects with table filters, CRUD actions, and CSV tools.</p>
        </div>
        <RedirectHeaderActions />
      </header>

      <WorkspaceRedirectsTable />
    </section>
  );
}
