import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { AdminLoginForm } from '@/components/forms/admin-login-form';
import { AdminTabs } from '@/components/admin-tabs';
import { env } from '@/lib/env';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { isAdminSessionActive } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type AppRow = {
  id: string;
  full_name: string;
  assignment_ref: string;
  job_ref: string;
  applied_at: string;
  job_title: string;
};

type ExitRow = {
  id: string;
  full_name: string;
  job_ref: string;
  job_title: string;
  created_at: string;
};

async function getRecentFilledApplications(admin: ReturnType<typeof createSupabaseAdminClient>): Promise<AppRow[]> {
  const { data: activeAssignments } = await admin
    .from('assignments')
    .select('assignment_ref')
    .eq('active', true);

  const activeRefs = (activeAssignments || []).map((row) => row.assignment_ref);
  if (!activeRefs.length) return [];

  const { data: archives } = await admin
    .from('applications_archive')
    .select('id,job_id,full_name,assignment_ref,applied_at')
    .in('assignment_ref', activeRefs)
    .order('applied_at', { ascending: false })
    .limit(20);

  const rows = archives || [];
  const jobIds = [...new Set(rows.map((row) => row.job_id).filter(Boolean))];
  const { data: jobs } = jobIds.length
    ? await admin.from('jobs').select('id,title,job_ref').in('id', jobIds)
    : { data: [] as Array<{ id: string; title: string; job_ref: string }> };
  const byId = new Map((jobs || []).map((j) => [j.id, j]));

  return rows.map((row) => ({
    id: row.id,
    full_name: row.full_name,
    assignment_ref: row.assignment_ref,
    job_ref: byId.get(row.job_id)?.job_ref || 'N/A',
    applied_at: row.applied_at,
    job_title: byId.get(row.job_id)?.title || 'Unknown role'
  }));
}

async function getRecentResignations(admin: ReturnType<typeof createSupabaseAdminClient>): Promise<ExitRow[]> {
  const { data: exits } = await admin
    .from('exit_interviews')
    .select('id,full_name,job_title,created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  const rows = exits || [];
  const titles = [...new Set(rows.map((row) => row.job_title).filter(Boolean))];
  const { data: jobs } = titles.length
    ? await admin.from('jobs').select('title,job_ref').in('title', titles)
    : { data: [] as Array<{ title: string; job_ref: string }> };

  const firstRefByTitle = new Map<string, string>();
  (jobs || []).forEach((j) => {
    if (!firstRefByTitle.has(j.title)) firstRefByTitle.set(j.title, j.job_ref);
  });

  return rows.map((row) => ({
    id: row.id,
    full_name: row.full_name,
    job_title: row.job_title,
    created_at: row.created_at,
    job_ref: firstRefByTitle.get(row.job_title) || 'N/A'
  }));
}

function DashboardView({
  archives,
  exits,
  showBypassBanner
}: {
  archives: AppRow[];
  exits: ExitRow[];
  showBypassBanner: boolean;
}) {
  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl font-black">Admin Dashboard</h1>
        <AdminTabs current="dashboard" />
      </div>

      {showBypassBanner ? (
        <p className="rounded-md bg-amber-100 p-3 font-semibold">Admin auth bypass is enabled for testing.</p>
      ) : null}

      <div className="space-y-5">
        <section className="card">
          <h2 className="text-xl font-bold">Recent applications</h2>
          <div className="mt-2 overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-3">Job Number</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Job Title</th>
                  <th className="py-2 pr-3">Applied At</th>
                  <th className="py-2 pr-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {archives.map((a) => (
                  <tr key={a.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3">{a.job_ref}</td>
                    <td className="py-2 pr-3">{a.full_name}</td>
                    <td className="py-2 pr-3">{a.job_title}</td>
                    <td className="py-2 pr-3">
                      {new Date(a.applied_at).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>
                    <td className="py-2 pr-3">
                      <Link href={`/admin/applications/${a.id}`} className="btn-secondary">View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <h2 className="text-xl font-bold">Recent resignations</h2>
          <div className="mt-2 overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-3">Job Number</th>
                  <th className="py-2 pr-3">Name</th>
                  <th className="py-2 pr-3">Job Title</th>
                  <th className="py-2 pr-3">Resigned At</th>
                </tr>
              </thead>
              <tbody>
                {exits.map((e) => (
                  <tr key={e.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-3">{e.job_ref}</td>
                    <td className="py-2 pr-3">{e.full_name}</td>
                    <td className="py-2 pr-3">{e.job_title}</td>
                    <td className="py-2 pr-3">{new Date(e.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </section>
  );
}

export default async function AdminPage() {
  noStore();

  if (env.adminAuthDisabled) {
    const admin = createSupabaseAdminClient();
    const [archives, exits] = await Promise.all([
      getRecentFilledApplications(admin),
      getRecentResignations(admin)
    ]);

    return (
      <DashboardView
        archives={archives}
        exits={exits}
        showBypassBanner
      />
    );
  }

  if (!isAdminSessionActive()) {
    return (
      <section className="space-y-4">
        <h1 className="text-4xl font-black">Admin Dashboard</h1>
        <p>Only the configured admin email can access this dashboard.</p>
        <AdminLoginForm />
      </section>
    );
  }

  const admin = createSupabaseAdminClient();
  const [archives, exits] = await Promise.all([
    getRecentFilledApplications(admin),
    getRecentResignations(admin)
  ]);

  return (
    <DashboardView
      archives={archives}
      exits={exits}
      showBypassBanner={false}
    />
  );
}
