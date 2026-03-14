import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { WorkspaceJobEditForm } from '@/components/workspace/workspace-job-edit-form';
import { getSettings } from '@/lib/data';
import { createSupabaseAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkspaceJobEditPage({ params }: { params: { jobId: string } }) {
  noStore();

  const admin = createSupabaseAdminClient();
  const [{ data: job }, settings] = await Promise.all([
    admin.from('jobs').select('*').eq('id', params.jobId).maybeSingle(),
    getSettings()
  ]);

  if (!job) notFound();

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
        <h1 className="text-2xl font-semibold text-slate-900">Edit Job</h1>
        <p className="text-sm text-slate-600">Update role details for this position.</p>
      </header>

      <WorkspaceJobEditForm
        job={job}
        reportsToOptions={settings.reports_to_options}
        salaryBenefitOptions={settings.salary_benefit_options}
        rehiringReasons={settings.rehiring_reasons}
        afterSaveRedirectPath="/workspace/dashboard/jobs"
        cancelHref="/workspace/dashboard/jobs"
      />
    </section>
  );
}
