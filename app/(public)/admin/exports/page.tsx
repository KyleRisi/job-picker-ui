import { redirect } from 'next/navigation';
import { AdminTabs } from '@/components/admin-tabs';
import { AdminActiveRolesUpload } from '@/components/forms/admin-active-roles-upload';
import { AdminExportLinks } from '@/components/forms/admin-export-links';
import { env } from '@/lib/env';
import { isAdminSessionActive } from '@/lib/admin-session';

export default async function ExportsPage() {
  if (env.adminAuthDisabled) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-4xl font-black">CSV Exports</h1>
          <AdminTabs current="exports" />
        </div>
        <p className="rounded-md bg-amber-100 p-3 font-semibold">Admin auth bypass is enabled for testing.</p>
        <div className="space-y-3">
          <AdminExportLinks />
          <AdminActiveRolesUpload />
        </div>
      </section>
    );
  }

  if (!isAdminSessionActive()) redirect('/admin');

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl font-black">CSV Exports</h1>
        <AdminTabs current="exports" />
      </div>
      <div className="space-y-3">
        <AdminExportLinks />
        <AdminActiveRolesUpload />
      </div>
    </section>
  );
}
