import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { AdminActionMenu } from '@/components/admin-action-menu';
import { AdminTabs } from '@/components/admin-tabs';
import { AdminJobsForm } from '@/components/forms/admin-jobs-form';
import { getSettings } from '@/lib/data';
import { env } from '@/lib/env';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { isAdminSessionActive } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ReadyForShowMeta = {
  applicationId: string;
  broadcasted: boolean;
};

async function getFilledApplicationMap(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data: activeAssignments } = await admin
    .from('assignments')
    .select(
      'job_id,assignment_ref,full_name,email,q1,q2,q3,day_to_day,incidents,kpi_assessment,consent_read_on_show'
    )
    .eq('active', true);

  const refs = (activeAssignments || []).map((a) => a.assignment_ref);
  if (!refs.length) return {} as Record<string, string>;

  let { data: archives } = await admin
    .from('applications_archive')
    .select('id,assignment_ref')
    .in('assignment_ref', refs);

  const existingRefs = new Set((archives || []).map((a) => a.assignment_ref));
  const missingRows = (activeAssignments || []).filter((a) => !existingRefs.has(a.assignment_ref));
  if (missingRows.length) {
    await admin.from('applications_archive').insert(
      missingRows.map((a) => ({
        job_id: a.job_id,
        assignment_ref: a.assignment_ref,
        full_name: a.full_name || '-',
        email: a.email || 'unknown@example.invalid',
        q1: a.q1 || '-',
        q2: a.q2 || '-',
        q3: a.q3 || '-',
        day_to_day: a.day_to_day || '',
        incidents: a.incidents || '',
        kpi_assessment: a.kpi_assessment || '',
        consent_read_on_show: Boolean(a.consent_read_on_show)
      }))
    );
    const refreshed = await admin
      .from('applications_archive')
      .select('id,assignment_ref')
      .in('assignment_ref', refs);
    archives = refreshed.data || [];
  }

  const appIdByRef = new Map((archives || []).map((a) => [a.assignment_ref, a.id]));
  const byJob: Record<string, string> = {};
  (activeAssignments || []).forEach((a) => {
    const appId = appIdByRef.get(a.assignment_ref);
    if (appId) byJob[a.job_id] = appId;
  });
  return byJob;
}

async function getHolderNameByJobId(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data: activeAssignments } = await admin
    .from('assignments')
    .select('job_id,full_name')
    .eq('active', true);
  const byJob: Record<string, string> = {};
  (activeAssignments || []).forEach((a) => {
    byJob[a.job_id] = a.full_name;
  });
  return byJob;
}

async function getResignationCountByJobId(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  jobs: Array<{ id: string; title: string }>
) {
  const { data: exits } = await admin.from('exit_interviews').select('job_title');
  const countByTitle: Record<string, number> = {};
  (exits || []).forEach((row) => {
    const title = `${row.job_title || ''}`.trim();
    if (!title) return;
    countByTitle[title] = (countByTitle[title] || 0) + 1;
  });

  const byJobId: Record<string, number> = {};
  jobs.forEach((job) => {
    byJobId[job.id] = countByTitle[job.title] || 0;
  });
  return byJobId;
}

async function getReadyForShowMetaByJobId(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data: activeAssignments } = await admin
    .from('assignments')
    .select('job_id,assignment_ref')
    .eq('active', true);

  const assignments = activeAssignments || [];
  const refs = assignments.map((row) => row.assignment_ref).filter(Boolean);
  const jobIds = [...new Set(assignments.map((row) => row.job_id).filter(Boolean))];
  if (!refs.length || !jobIds.length) return {} as Record<string, ReadyForShowMeta>;

  let { data: archives, error } = await admin
    .from('applications_archive')
    .select('id,assignment_ref,day_to_day,incidents,kpi_assessment,consent_read_on_show,broadcasted_on_show')
    .in('assignment_ref', refs);

  // Backward compatibility if broadcast columns are not yet migrated in DB.
  if (error?.message?.includes('broadcasted_on_show')) {
    const fallback = await admin
      .from('applications_archive')
      .select('id,assignment_ref,day_to_day,incidents,kpi_assessment,consent_read_on_show')
      .in('assignment_ref', refs);
    archives = (fallback.data || []).map((row) => ({ ...row, broadcasted_on_show: false }));
  }

  const archiveByRef = new Map((archives || []).map((row) => [row.assignment_ref, row]));

  const readyByJobId: Record<string, ReadyForShowMeta> = {};
  assignments.forEach((row) => {
    const archive = archiveByRef.get(row.assignment_ref);
    if (!archive) return;
    const dayToDay = `${archive.day_to_day || ''}`.trim();
    const incidents = `${archive.incidents || ''}`.trim();
    const kpi = `${archive.kpi_assessment || ''}`.trim();
    const consent = Boolean(archive.consent_read_on_show);
    if (consent && dayToDay && incidents && kpi) {
      readyByJobId[row.job_id] = {
        applicationId: archive.id,
        broadcasted: Boolean(archive.broadcasted_on_show)
      };
    }
  });

  return readyByJobId;
}

function applyComputedStatus(
  jobs: Array<{ id: string; status: string; [key: string]: unknown }>,
  holderNameByJobId: Record<string, string>
) {
  return jobs.map((job) => ({
    ...job,
    status: Object.prototype.hasOwnProperty.call(holderNameByJobId, job.id) ? 'FILLED' : job.status
  }));
}

function filterJobsByView<T extends { id: string; status: string }>(
  jobs: T[],
  view: string,
  readyForShowJobIds: Set<string>,
  broadcastFilter: string,
  readyForShowMetaByJobId: Record<string, ReadyForShowMeta>
) {
  if (view === 'FILLED') return jobs.filter((job) => job.status === 'FILLED');
  if (view === 'AVAILABLE') return jobs.filter((job) => job.status === 'AVAILABLE' || job.status === 'REHIRING');
  if (view === 'REHIRING') return jobs.filter((job) => job.status === 'REHIRING');
  if (view === 'READY_FOR_SHOW') {
    return jobs.filter((job) => {
      if (!readyForShowJobIds.has(job.id)) return false;
      if (broadcastFilter === 'BROADCAST') return Boolean(readyForShowMetaByJobId[job.id]?.broadcasted);
      if (broadcastFilter === 'NOT_BROADCAST') return !Boolean(readyForShowMetaByJobId[job.id]?.broadcasted);
      return true;
    });
  }
  return jobs;
}

function getTitle(view: string) {
  if (view === 'FILLED') return 'Filled Jobs';
  if (view === 'AVAILABLE') return 'Available Jobs';
  if (view === 'REHIRING') return 'Re-hiring Jobs';
  if (view === 'READY_FOR_SHOW') return 'Ready for Show';
  return 'All Jobs';
}

export default async function AdminJobsPage({
  searchParams
}: {
  searchParams?: { status?: string; action?: string; at?: string; broadcast?: string };
}) {
  noStore();

  const view = ((searchParams?.status || 'ALL').toUpperCase());
  const validView = ['ALL', 'AVAILABLE', 'FILLED', 'REHIRING', 'READY_FOR_SHOW'].includes(view) ? view : 'ALL';
  const broadcastFilterRaw = ((searchParams?.broadcast || 'ALL').toUpperCase());
  const broadcastFilter = ['ALL', 'BROADCAST', 'NOT_BROADCAST'].includes(broadcastFilterRaw)
    ? broadcastFilterRaw
    : 'ALL';
  const action = (searchParams?.action || '').toLowerCase();
  const initialPanel: 'single' | 'bulk' | null =
    action === 'create' ? 'single' : action === 'bulk' ? 'bulk' : null;
  const panelTrigger = `${action}:${searchParams?.at || ''}`;

  if (env.adminAuthDisabled) {
    const admin = createSupabaseAdminClient();
    const [{ data: jobs }, filledApplicationByJobId, holderNameByJobId, settings, readyForShowMetaByJobId] = await Promise.all([
      admin.from('jobs').select('*').order('job_ref', { ascending: false }),
      getFilledApplicationMap(admin),
      getHolderNameByJobId(admin),
      getSettings(),
      getReadyForShowMetaByJobId(admin)
    ]);
    const readyForShowJobIds = new Set(Object.keys(readyForShowMetaByJobId));
    const computedJobs = applyComputedStatus((jobs || []) as Array<{ id: string; status: string }>, holderNameByJobId) as typeof jobs;
    const filteredJobs = filterJobsByView(
      computedJobs || [],
      validView,
      readyForShowJobIds,
      broadcastFilter,
      readyForShowMetaByJobId
    );
    const rehiringResignCountByJobId = await getResignationCountByJobId(
      admin,
      (filteredJobs || []) as Array<{ id: string; title: string }>
    );

    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-black">{getTitle(validView)}</h1>
            <span className="rounded-full bg-carnival-red px-3 py-1 text-sm font-bold text-white">
              {filteredJobs.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <AdminTabs current="jobs" />
            <AdminActionMenu />
          </div>
        </div>
        <p className="rounded-md bg-amber-100 p-3 font-semibold">Admin auth bypass is enabled for testing.</p>
        <AdminJobsForm
          jobs={filteredJobs}
          filledApplicationByJobId={filledApplicationByJobId}
          holderNameByJobId={holderNameByJobId}
          reportsToOptions={settings.reports_to_options}
          salaryBenefitOptions={settings.salary_benefit_options}
          showPersonNameColumn={validView !== 'AVAILABLE' && validView !== 'ALL'}
          isFilledView={validView === 'FILLED'}
          isRehiringView={validView === 'REHIRING'}
          isReadyForShowView={validView === 'READY_FOR_SHOW'}
          readyForShowMetaByJobId={readyForShowMetaByJobId}
          broadcastFilter={broadcastFilter}
          rehiringResignCountByJobId={rehiringResignCountByJobId}
          initialPanel={initialPanel}
          panelTrigger={panelTrigger}
        />
      </section>
    );
  }

  if (!isAdminSessionActive()) redirect('/admin');

  const admin = createSupabaseAdminClient();
  const [{ data: jobs }, filledApplicationByJobId, holderNameByJobId, settings, readyForShowMetaByJobId] = await Promise.all([
    admin.from('jobs').select('*').order('job_ref', { ascending: false }),
    getFilledApplicationMap(admin),
    getHolderNameByJobId(admin),
    getSettings(),
    getReadyForShowMetaByJobId(admin)
  ]);
  const readyForShowJobIds = new Set(Object.keys(readyForShowMetaByJobId));
  const computedJobs = applyComputedStatus((jobs || []) as Array<{ id: string; status: string }>, holderNameByJobId) as typeof jobs;
  const filteredJobs = filterJobsByView(
    computedJobs || [],
    validView,
    readyForShowJobIds,
    broadcastFilter,
    readyForShowMetaByJobId
  );
  const rehiringResignCountByJobId = await getResignationCountByJobId(
    admin,
    (filteredJobs || []) as Array<{ id: string; title: string }>
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-black">{getTitle(validView)}</h1>
          <span className="rounded-full bg-carnival-red px-3 py-1 text-sm font-bold text-white">
            {filteredJobs.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AdminTabs current="jobs" />
          <AdminActionMenu />
        </div>
      </div>
      <AdminJobsForm
        jobs={filteredJobs}
        filledApplicationByJobId={filledApplicationByJobId}
        holderNameByJobId={holderNameByJobId}
        reportsToOptions={settings.reports_to_options}
        salaryBenefitOptions={settings.salary_benefit_options}
        showPersonNameColumn={validView !== 'AVAILABLE' && validView !== 'ALL'}
        isFilledView={validView === 'FILLED'}
        isRehiringView={validView === 'REHIRING'}
        isReadyForShowView={validView === 'READY_FOR_SHOW'}
        readyForShowMetaByJobId={readyForShowMetaByJobId}
        broadcastFilter={broadcastFilter}
        rehiringResignCountByJobId={rehiringResignCountByJobId}
        initialPanel={initialPanel}
        panelTrigger={panelTrigger}
      />
    </section>
  );
}
