import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { AdminApplicationActionsMenu } from '@/components/forms/admin-application-actions-menu';
import { AdminApplicationPhotoEditor } from '@/components/forms/admin-application-photo-editor';
import { AdminApplicationRoleEditor } from '@/components/forms/admin-application-role-editor';
import { WorkspaceApplicationEditor } from '@/components/workspace/workspace-application-editor';
import { StatusPill } from '@/components/status-pill';
import { getSettings } from '@/lib/data';
import { getDefaultSalaryBenefits } from '@/lib/job-salary';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { sanitizeReplacementChars } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkspaceApplicationDetailPage({
  params,
  searchParams
}: {
  params: { applicationId: string };
  searchParams?: { edit_role?: string };
}) {
  noStore();

  const admin = createSupabaseAdminClient();
  const { data: application } = await admin
    .from('applications_archive')
    .select('*')
    .eq('id', params.applicationId)
    .single();

  if (!application) notFound();
  const [{ data: job }, { data: activeAssignment }, settings] = await Promise.all([
    admin
      .from('jobs')
      .select('id,title,description,job_ref,reports_to,status,salary_benefits')
      .eq('id', application.job_id)
      .maybeSingle(),
    admin
      .from('assignments')
      .select('full_name,email,q1,q2,q3,day_to_day,incidents,kpi_assessment,consent_read_on_show,profile_photo_data_url')
      .eq('job_id', application.job_id)
      .eq('active', true)
      .maybeSingle(),
    getSettings()
  ]);

  const sanitizeImportedValue = (value: string | null) =>
    value === 'Imported via existing employees bulk CSV.' ? '' : value || '';
  const editRoleOpen = searchParams?.edit_role === '1';
  const appliedDate = new Date(application.applied_at)
    .toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
    .replace(/^(\d{2}) (\w{3}) (\d{4})$/, '$1 $2, $3');
  const salaryBenefits = sanitizeReplacementChars(
    (job?.salary_benefits || '').trim() || getDefaultSalaryBenefits(job?.job_ref || '')
  );

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

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Application Detail</h1>
        <AdminApplicationActionsMenu
          id={application.id}
          broadcastedOnShow={Boolean(application.broadcasted_on_show)}
          editRoleOpen={editRoleOpen}
          postActionRedirectPath="/workspace/dashboard/jobs"
          variant="workspace"
        />
      </div>

      <section className="rounded-md border border-slate-300 bg-white p-4 sm:p-5">
        <div className="rounded-md border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <div className="mb-5 space-y-1 sm:flex sm:items-start sm:justify-between sm:space-y-0">
            <h2 className="hidden text-xl font-semibold text-slate-900 sm:block">Employee File</h2>
            <div>
              <p className="text-center text-sm font-semibold text-slate-700 sm:text-right">
                <span className="font-semibold text-slate-700">Job reference:</span>{' '}
                <span className="font-bold text-slate-900">{job?.job_ref || 'N/A'}</span>
              </p>
              <div className="mt-2 flex justify-center sm:hidden">
                <StatusPill status={job?.status || 'FILLED'} />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <AdminApplicationPhotoEditor
              applicationId={application.id}
              fullName={activeAssignment?.full_name || application.full_name || 'Applicant'}
              imageUrl={activeAssignment?.profile_photo_data_url || application.profile_photo_data_url || null}
              variant="workspace"
            />
            <div className="min-w-0">
              <p className="mb-0 text-base font-semibold text-slate-800">{activeAssignment?.full_name || application.full_name}</p>
              <p className="mb-1 text-sm font-medium text-slate-600">{activeAssignment?.email || application.email}</p>
              <p className="mb-2 text-xs font-semibold text-slate-500">Employed since: {appliedDate}</p>
              <h2 className="text-3xl font-semibold leading-tight text-slate-900">
                {sanitizeReplacementChars(job?.title || 'Unknown role')}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-slate-700">
                {sanitizeReplacementChars(job?.description || '')}
              </p>
            </div>
          </div>
          <div className="mt-4 border-t border-slate-200 pt-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-1 text-sm text-slate-700">
                <p><strong>Salary:</strong> {salaryBenefits}</p>
                <p><strong>Reports to:</strong> {sanitizeReplacementChars(job?.reports_to || 'N/A')}</p>
              </div>
              <div className="hidden self-start sm:block sm:self-auto">
                <StatusPill status={job?.status || 'FILLED'} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {editRoleOpen && job ? (
        <AdminApplicationRoleEditor
          job={{
            id: job.id,
            title: sanitizeReplacementChars(job.title || ''),
            description: sanitizeReplacementChars(job.description || ''),
            reports_to: sanitizeReplacementChars(job.reports_to || ''),
            status: (job.status || 'FILLED') as 'AVAILABLE' | 'FILLED' | 'REHIRING',
            salary_benefits: job.salary_benefits || null,
            job_ref: job.job_ref || ''
          }}
          reportsToOptions={settings.reports_to_options}
          salaryBenefitOptions={settings.salary_benefit_options}
          closeOnSaveUrl={`/workspace/dashboard/jobs/applications/${application.id}`}
          variant="workspace"
        />
      ) : null}

      <WorkspaceApplicationEditor
        application={{
          id: application.id,
          full_name: activeAssignment?.full_name || application.full_name || '',
          email: activeAssignment?.email || application.email || '',
          q1: sanitizeImportedValue(activeAssignment?.q1 || application.q1),
          q2: sanitizeImportedValue(activeAssignment?.q2 || application.q2),
          q3: sanitizeImportedValue(activeAssignment?.q3 || application.q3),
          day_to_day: sanitizeImportedValue(activeAssignment?.day_to_day || application.day_to_day),
          incidents: sanitizeImportedValue(activeAssignment?.incidents || application.incidents),
          kpi_assessment: sanitizeImportedValue(activeAssignment?.kpi_assessment || application.kpi_assessment),
          consent_read_on_show: Boolean(
            typeof activeAssignment?.consent_read_on_show === 'boolean'
              ? activeAssignment.consent_read_on_show
              : application.consent_read_on_show
          ),
          profile_photo_data_url: activeAssignment?.profile_photo_data_url || application.profile_photo_data_url || null
        }}
      />
    </section>
  );
}
