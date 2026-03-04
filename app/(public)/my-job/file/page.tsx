import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { HrFileForm } from '@/components/forms/hr-file-form';
import { MyJobPhotoEditor } from '@/components/forms/my-job-photo-editor';
import { StatusPill } from '@/components/status-pill';
import { getDefaultSalaryBenefits } from '@/lib/job-salary';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { normalizeAssignmentRef, normalizeEmail, sanitizeReplacementChars } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function HrFilePage({
  searchParams
}: {
  searchParams: { email?: string; ref?: string };
}) {
  noStore();

  const accessEmail = searchParams.email ? normalizeEmail(searchParams.email) : '';
  const accessRef = searchParams.ref ? normalizeAssignmentRef(searchParams.ref) : '';
  if (!accessEmail || !accessRef) redirect('/my-job');

  const admin = createSupabaseAdminClient();
  const { data: assignment } = await admin
    .from('assignments')
    .select('*, jobs(title,description,job_ref,reports_to,status,salary_benefits)')
    .eq('active', true)
    .ilike('email', accessEmail)
    .eq('assignment_ref', accessRef)
    .single();

  if (!assignment) {
    redirect('/my-job?error=No active assignment found for that email and reference.');
  }

  const jobRef = assignment.jobs?.job_ref || 'N/A';
  const salary =
    sanitizeReplacementChars((assignment.jobs?.salary_benefits || '').trim()) ||
    getDefaultSalaryBenefits(assignment.jobs?.job_ref || '');
  const headerDescription = sanitizeReplacementChars(assignment.jobs?.description || '');
  const employedSince = new Date(assignment.created_at)
    .toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
    .replace(/^(\d{2}) (\w{3}) (\d{4})$/, '$1 $2, $3');

  return (
    <section className="space-y-4">
      <h1 className="text-4xl font-black">My HR File</h1>
      <div className="card overflow-hidden p-0">
        <div className="bg-carnival-ink/5 p-6">
          <div className="mb-5 space-y-1 sm:flex sm:items-start sm:justify-between sm:space-y-0">
            <h2 className="hidden text-xl font-black text-carnival-ink sm:block">Employee File</h2>
            <div>
              <p className="text-center text-sm font-bold text-carnival-ink sm:text-right">
                <span className="font-black text-carnival-ink">Job reference:</span>{' '}
                <span className="font-extrabold text-carnival-red">{jobRef}</span>
              </p>
              <div className="mt-2 flex justify-center sm:hidden">
                <StatusPill status={assignment.jobs?.status || 'FILLED'} />
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <MyJobPhotoEditor
              assignmentId={assignment.id}
              fullName={assignment.full_name}
              imageUrl={assignment.profile_photo_data_url || null}
              accessEmail={accessEmail}
              accessRef={accessRef}
            />
            <div className="min-w-0">
              <p className="mb-0 text-base font-semibold text-carnival-ink/80">{assignment.full_name}</p>
              <p className="mb-1 text-sm font-medium text-carnival-ink/70">{assignment.email}</p>
              <p className="mb-2 text-xs font-semibold text-carnival-ink/65">Employed since: {employedSince}</p>
              <h2 className="text-[1.55rem] font-black leading-[1.08] text-carnival-ink sm:text-[1.95rem] md:text-[2.3rem]">
                {sanitizeReplacementChars(assignment.jobs?.title || 'Unknown role')}
              </h2>
              <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-carnival-ink/80">
                {headerDescription}
              </p>
            </div>
          </div>
          <div className="mt-4 border-t border-carnival-ink/10 pt-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-1 text-sm text-carnival-ink/85">
                <p><strong>Salary:</strong> {salary}</p>
                <p><strong>Reports to:</strong> {sanitizeReplacementChars(assignment.jobs?.reports_to || 'N/A')}</p>
              </div>
              <div className="hidden self-start sm:block sm:self-auto">
                <StatusPill status={assignment.jobs?.status || 'FILLED'} />
              </div>
                </div>
              </div>
        </div>
      </div>

      <HrFileForm
        assignmentId={assignment.id}
        initialFullName={assignment.full_name}
        initialEmail={assignment.email}
        jobTitle={assignment.jobs?.title || ''}
        q1={assignment.q1 || ''}
        q2={assignment.q2 || ''}
        q3={assignment.q3 || ''}
        consentReadOnShow={Boolean(assignment.consent_read_on_show)}
        dayToDay={assignment.day_to_day}
        incidents={assignment.incidents}
        kpi={assignment.kpi_assessment}
        accessEmail={accessEmail}
        accessRef={accessRef}
      />
    </section>
  );
}
