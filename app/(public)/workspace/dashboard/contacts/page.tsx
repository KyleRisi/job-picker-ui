import { unstable_noStore as noStore } from 'next/cache';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { WorkspaceContactsTable, type WorkspaceContactSubmissionRow } from '@/components/workspace/workspace-contacts-table';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkspaceContactsPage() {
  noStore();

  const admin = createSupabaseAdminClient();
  const query = admin
    .from('contact_submissions')
    .select('id,name,email,reason,subject,message,status,created_at')
    .order('created_at', { ascending: false })
    .limit(150);

  const { data, error } = await query;
  const rows = (data || []) as WorkspaceContactSubmissionRow[];

  return (
    <section className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-900">Contact Submissions</h1>
        <p className="text-sm text-slate-600">Messages submitted via the website contact form.</p>
      </header>

      {error ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          Unable to load contact submissions. If this is a new setup, apply migration `0010_create_contact_submissions_table.sql`.
        </p>
      ) : null}

      <WorkspaceContactsTable submissions={rows} />
    </section>
  );
}
