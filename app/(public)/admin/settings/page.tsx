import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import Link from 'next/link';
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
        <Link href="/admin" className="inline-block text-sm font-semibold underline">
          Back to dashboard
        </Link>
        <h1 className="mb-4 text-4xl font-black">Admin settings</h1>
        <p className="mb-4 rounded-md bg-amber-100 p-3 font-semibold">Admin auth bypass is enabled for testing.</p>
        <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-start">
          <AdminTabs current="settings" />
          <AdminSettingsForm
            showFilled={settings.show_filled_first_names}
            disableSignups={settings.disable_new_signups}
            reportsToOptions={settings.reports_to_options}
            salaryBenefitOptions={settings.salary_benefit_options}
            rehiringReasons={settings.rehiring_reasons}
          />
        </div>
      </section>
    );
  }

  if (!isAdminSessionActive()) redirect('/admin');

  const settings = await getSettings();

  return (
    <section>
      <Link href="/admin" className="inline-block text-sm font-semibold underline">
        Back to dashboard
      </Link>
      <h1 className="mb-4 text-4xl font-black">Admin settings</h1>
      <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-start">
        <AdminTabs current="settings" />
        <AdminSettingsForm
          showFilled={settings.show_filled_first_names}
          disableSignups={settings.disable_new_signups}
          reportsToOptions={settings.reports_to_options}
          salaryBenefitOptions={settings.salary_benefit_options}
          rehiringReasons={settings.rehiring_reasons}
        />
      </div>
    </section>
  );
}
