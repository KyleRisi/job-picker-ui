import { notFound, redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { AdminTabs } from '@/components/admin-tabs';
import { AdminGoBackButton } from '@/components/admin-go-back-button';
import { AdminJobEditForm } from '@/components/forms/admin-job-edit-form';
import { getSettings } from '@/lib/data';
import { env } from '@/lib/env';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { isAdminSessionActive } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminJobEditPage({ params }: { params: { id: string } }) {
  noStore();

  if (!env.adminAuthDisabled) {
    if (!isAdminSessionActive()) redirect('/admin');
  }

  const admin = createSupabaseAdminClient();
  const [{ data: job }, settings] = await Promise.all([
    admin.from('jobs').select('*').eq('id', params.id).single(),
    getSettings()
  ]);
  if (!job) notFound();

  return (
    <section className="space-y-4">
      <AdminGoBackButton />
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl font-black">Edit Job</h1>
        <AdminTabs current="jobs" />
      </div>
      <AdminJobEditForm
        job={job}
        reportsToOptions={settings.reports_to_options}
        salaryBenefitOptions={settings.salary_benefit_options}
        rehiringReasons={settings.rehiring_reasons}
      />
    </section>
  );
}
