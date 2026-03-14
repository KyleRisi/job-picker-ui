import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { WorkspaceJobCreateForm } from '@/components/workspace/workspace-job-create-form';
import { getSettings } from '@/lib/data';
import { createSupabaseAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getNextJobRef(jobRefs: string[]) {
  let max = 0;
  for (const value of jobRefs) {
    const match = /^JOB-(\d+)$/i.exec(`${value || ''}`.trim());
    if (!match) continue;
    const parsed = Number.parseInt(match[1], 10);
    if (Number.isFinite(parsed) && parsed > max) max = parsed;
  }
  return `JOB-${String(max + 1).padStart(4, '0')}`;
}

export default async function WorkspaceJobCreatePage() {
  noStore();

  const admin = createSupabaseAdminClient();
  const [{ data: jobs }, settings] = await Promise.all([
    admin.from('jobs').select('job_ref'),
    getSettings()
  ]);

  const nextJobRef = getNextJobRef((jobs || []).map((job) => `${job.job_ref || ''}`));

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
        <h1 className="text-2xl font-semibold text-slate-900">Add New Job</h1>
        <p className="text-sm text-slate-600">Create a new role using workspace job settings.</p>
      </header>

      <WorkspaceJobCreateForm
        nextJobRef={nextJobRef}
        reportsToOptions={settings.reports_to_options}
        salaryBenefitOptions={settings.salary_benefit_options}
      />
    </section>
  );
}
