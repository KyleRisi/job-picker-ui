import { unstable_noStore as noStore } from 'next/cache';
import { getSettings } from '@/lib/data';
import { WorkspaceJobsDefaultsEditor } from '@/components/workspace/workspace-jobs-defaults-editor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkspaceJobsDefaultsPage() {
  noStore();

  let loadError = '';
  let settings = {
    show_filled_first_names: true,
    disable_new_signups: false,
    reports_to_options: [] as string[],
    salary_benefit_options: [] as string[],
    rehiring_reasons: [] as string[]
  };

  try {
    settings = await getSettings();
  } catch (error) {
    loadError = 'Could not load jobs defaults right now.';
    console.error('Workspace jobs defaults failed to load:', error);
  }

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Jobs Defaults</h1>
        <p className="text-sm text-slate-600">Manage hiring managers, salary/benefits defaults, and re-hiring reasons.</p>
      </header>

      {loadError ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>
      ) : null}

      <WorkspaceJobsDefaultsEditor
        initialShowFilled={settings.show_filled_first_names}
        initialDisableSignups={settings.disable_new_signups}
        initialManagers={settings.reports_to_options}
        initialSalaryOptions={settings.salary_benefit_options}
        initialRehiringReasons={settings.rehiring_reasons}
      />
    </section>
  );
}
