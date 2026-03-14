import { redirect } from 'next/navigation';
import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { AdminTabs } from '@/components/admin-tabs';
import { AdminContactStatusForm } from '@/components/forms/admin-contact-status-form';
import { env } from '@/lib/env';
import { isAdminSessionActive } from '@/lib/admin-session';
import { createSupabaseAdminClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ContactSubmissionRow = {
  id: string;
  name: string;
  email: string;
  reason: 'general' | 'guest' | 'press' | 'sponsorship' | 'other';
  subject: string;
  message: string;
  status: 'new' | 'read' | 'archived';
  created_at: string;
};

type ContactFilter = 'all' | 'new' | 'read' | 'archived';

const FILTERS: Array<{ key: ContactFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'read', label: 'Read' },
  { key: 'archived', label: 'Archived' }
];

function normalizeFilter(value: string | string[] | undefined): ContactFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'new' || raw === 'read' || raw === 'archived') return raw;
  return 'all';
}

function reasonLabel(value: ContactSubmissionRow['reason']): string {
  if (value === 'guest') return 'Guest request';
  if (value === 'press') return 'Press / media';
  if (value === 'sponsorship') return 'Sponsorship';
  if (value === 'other') return 'Other';
  return 'General enquiry';
}

export default async function AdminContactsPage({
  searchParams
}: {
  searchParams?: { status?: string | string[] };
}) {
  noStore();

  if (!env.adminAuthDisabled && !isAdminSessionActive()) {
    redirect('/admin');
  }

  const selectedFilter = normalizeFilter(searchParams?.status);

  const admin = createSupabaseAdminClient();
  let query = admin
    .from('contact_submissions')
    .select('id,name,email,reason,subject,message,status,created_at')
    .order('created_at', { ascending: false })
    .limit(150);

  if (selectedFilter !== 'all') {
    query = query.eq('status', selectedFilter);
  }

  const { data, error } = await query;

  const rows = (data || []) as ContactSubmissionRow[];

  return (
    <section className="space-y-4">
      <Link href="/admin" className="inline-block text-sm font-semibold underline">
        Back to dashboard
      </Link>

      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl font-black">Contact Submissions</h1>
        <AdminTabs current="contacts" />
      </div>

      {env.adminAuthDisabled ? (
        <p className="rounded-md bg-amber-100 p-3 font-semibold">Admin auth bypass is enabled for testing.</p>
      ) : null}

      {error ? (
        <p className="rounded-md border border-carnival-red/25 bg-carnival-red/10 p-3 text-sm font-semibold text-carnival-red">
          Unable to load contact submissions. If this is a new setup, apply migration `0010_create_contact_submissions_table.sql`.
        </p>
      ) : null}

      <section className="card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">Recent messages</h2>
          <span className="rounded-full bg-carnival-red px-3 py-1 text-xs font-black uppercase tracking-wide text-white">
            {rows.length}
          </span>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const active = selectedFilter === filter.key;
            return (
              <Link
                key={filter.key}
                href={filter.key === 'all' ? '/admin/contacts' : `/admin/contacts?status=${filter.key}`}
                className={active ? 'btn-primary !px-3 !py-1.5 !text-xs' : 'btn-secondary !px-3 !py-1.5 !text-xs'}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>

        <div className="overflow-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Email</th>
                <th className="py-2 pr-3">Reason</th>
                <th className="py-2 pr-3">Subject</th>
                <th className="py-2 pr-3">Message</th>
                <th className="py-2 pr-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b align-top last:border-b-0">
                  <td className="py-2 pr-3 whitespace-nowrap">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-3 font-semibold">{row.name}</td>
                  <td className="py-2 pr-3">
                    <a href={`mailto:${row.email}`} className="underline">
                      {row.email}
                    </a>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{reasonLabel(row.reason)}</td>
                  <td className="py-2 pr-3 min-w-[220px]">{row.subject}</td>
                  <td className="py-2 pr-3 min-w-[320px] whitespace-pre-wrap text-carnival-ink/85">{row.message}</td>
                  <td className="py-2 pr-3 whitespace-nowrap">
                    <AdminContactStatusForm submissionId={row.id} initialStatus={row.status} />
                  </td>
                </tr>
              ))}
              {!rows.length && !error ? (
                <tr>
                  <td className="py-6 text-center text-sm text-carnival-ink/70" colSpan={7}>
                    No contact submissions yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}
