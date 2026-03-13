import { redirect } from 'next/navigation';
import Link from 'next/link';
import { AdminTabs } from '@/components/admin-tabs';
import { AdminActiveRolesUpload } from '@/components/forms/admin-active-roles-upload';
import { AdminExportLinks } from '@/components/forms/admin-export-links';
import { env } from '@/lib/env';
import { isAdminSessionActive } from '@/lib/admin-session';

export default async function ExportsPage() {
  if (env.adminAuthDisabled) {
    return (
      <section className="space-y-3">
        <Link href="/admin" className="inline-block text-sm font-semibold underline">
          Back to dashboard
        </Link>
        <h1 className="text-4xl font-black">CSV Exports</h1>
        <p className="rounded-md bg-amber-100 p-3 font-semibold">Admin auth bypass is enabled for testing.</p>
        <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-start">
          <AdminTabs current="exports" />
          <div className="space-y-3">
            <AdminExportLinks />
            <AdminActiveRolesUpload />
          </div>
        </div>
      </section>
    );
  }

  if (!isAdminSessionActive()) redirect('/admin');

  return (
    <section className="space-y-3">
      <Link href="/admin" className="inline-block text-sm font-semibold underline">
        Back to dashboard
      </Link>
      <h1 className="text-4xl font-black">CSV Exports</h1>
      <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-start">
        <AdminTabs current="exports" />
        <div className="space-y-3">
          <AdminExportLinks />
          <AdminActiveRolesUpload />
        </div>
      </div>
    </section>
  );
}
