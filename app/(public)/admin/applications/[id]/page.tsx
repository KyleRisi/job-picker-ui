import { notFound, redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { AdminTabs } from '@/components/admin-tabs';
import { AdminGoBackButton } from '@/components/admin-go-back-button';
import { AdminApplicationActionsMenu } from '@/components/forms/admin-application-actions-menu';
import { AdminApplicationEditor } from '@/components/forms/admin-application-editor';
import { AdminApplicationPhotoEditor } from '@/components/forms/admin-application-photo-editor';
import { AdminApplicationRoleEditor } from '@/components/forms/admin-application-role-editor';
import { env } from '@/lib/env';
import { getSettings } from '@/lib/data';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { sanitizeReplacementChars } from '@/lib/utils';
import { getDefaultSalaryBenefits } from '@/lib/job-salary';
import { StatusPill } from '@/components/status-pill';
import { isAdminSessionActive } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

export default async function AdminApplicationDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: { edit_role?: string };
}) {
  noStore();

  if (!env.adminAuthDisabled) {
    if (!isAdminSessionActive()) redirect('/admin');
  }

  const admin = createSupabaseAdminClient();
  const { data: application } = await admin
    .from('applications_archive')
    .select('*')
    .eq('id', params.id)
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
      <AdminGoBackButton />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-4xl font-black">Application Detail</h1>
        <div className="flex items-center gap-2 self-end">
          <AdminTabs current="jobs" />
          <AdminApplicationActionsMenu
            id={application.id}
            broadcastedOnShow={Boolean(application.broadcasted_on_show)}
            editRoleOpen={editRoleOpen}
          />
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="bg-carnival-ink/5 p-6">
          <div className="mb-5 space-y-1 sm:flex sm:items-start sm:justify-between sm:space-y-0">
            <h2 className="hidden text-xl font-black text-carnival-ink sm:block">Employee File</h2>
            <div>
              <p className="text-center text-sm font-bold text-carnival-ink sm:text-right">
                <span className="font-black text-carnival-ink">Job reference:</span>{' '}
                <span className="font-extrabold text-carnival-red">{job?.job_ref || 'N/A'}</span>
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
            />
            <div className="min-w-0">
              <p className="mb-0 text-base font-semibold text-carnival-ink/80">{activeAssignment?.full_name || application.full_name}</p>
              <p className="mb-1 text-sm font-medium text-carnival-ink/70">{activeAssignment?.email || application.email}</p>
              <p className="mb-2 text-xs font-semibold text-carnival-ink/65">Employed since: {appliedDate}</p>
              <h2 className="text-[1.55rem] font-black leading-[1.08] text-carnival-ink sm:text-[1.95rem] md:text-[2.3rem]">
                {sanitizeReplacementChars(job?.title || 'Unknown role')}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-carnival-ink/80">
                {sanitizeReplacementChars(job?.description || '')}
              </p>
            </div>
          </div>
          <div className="mt-4 border-t border-carnival-ink/10 pt-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-1 text-sm text-carnival-ink/85">
                <p><strong>Salary:</strong> {salaryBenefits}</p>
                <p><strong>Reports to:</strong> {sanitizeReplacementChars(job?.reports_to || 'N/A')}</p>
              </div>
              <div className="hidden self-start sm:block sm:self-auto">
                <StatusPill status={job?.status || 'FILLED'} />
              </div>
            </div>
          </div>
        </div>
      </div>

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
          closeOnSaveUrl={`/admin/applications/${application.id}`}
        />
      ) : null}

      <AdminApplicationEditor
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
