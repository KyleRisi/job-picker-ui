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

function BlogToolsCard() {
  return (
    <section className="card space-y-3">
      <h2 className="text-xl font-bold">Blog tools</h2>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/blog/media" className="btn-secondary">Media</Link>
        <Link href="/admin/blog/taxonomies" className="btn-secondary">Taxonomies</Link>
        <Link href="/admin/blog/episodes" className="btn-secondary">Episodes</Link>
      </div>
    </section>
  );
}

export default async function SettingsPage() {
  noStore();

  if (env.adminAuthDisabled) {
    const settings = await getSettings();
    return (
      <section className="space-y-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h1 className="text-4xl font-black">Admin settings</h1>
          <AdminTabs current="settings" />
        </div>
        <p className="mb-4 rounded-md bg-amber-100 p-3 font-semibold">Admin auth bypass is enabled for testing.</p>
        <BlogToolsCard />
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
    <section className="space-y-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-4xl font-black">Admin settings</h1>
        <AdminTabs current="settings" />
      </div>
      <BlogToolsCard />
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
