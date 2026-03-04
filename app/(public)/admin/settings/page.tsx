import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { AdminTabs } from '@/components/admin-tabs';
import { AdminSettingsForm } from '@/components/forms/admin-settings-form';
import { getSettings } from '@/lib/data';
import { env } from '@/lib/env';
import { isAdminSessionActive } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SettingsPage() {
  noStore();

  if (env.adminAuthDisabled) {
    const settings = await getSettings();
    return (
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-4xl font-black">Admin settings</h1>
          <AdminTabs current="settings" />
        </div>
        <p className="mb-4 rounded-md bg-amber-100 p-3 font-semibold">Admin auth bypass is enabled for testing.</p>
        <AdminSettingsForm
          showFilled={settings.show_filled_first_names}
          disableSignups={settings.disable_new_signups}
          reportsToOptions={settings.reports_to_options}
          salaryBenefitOptions={settings.salary_benefit_options}
          rehiringReasons={settings.rehiring_reasons}
        />
      </section>
    );
  }

  if (!isAdminSessionActive()) redirect('/admin');

  const settings = await getSettings();

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-4xl font-black">Admin settings</h1>
        <AdminTabs current="settings" />
      </div>
      <AdminSettingsForm
        showFilled={settings.show_filled_first_names}
        disableSignups={settings.disable_new_signups}
        reportsToOptions={settings.reports_to_options}
        salaryBenefitOptions={settings.salary_benefit_options}
        rehiringReasons={settings.rehiring_reasons}
      />
    </section>
  );
}
