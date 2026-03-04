import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { AdminTabs } from '@/components/admin-tabs';
import { AdminContactDeleteButton } from '@/components/forms/admin-contact-delete-button';
import { AdminContactsReasonFilter } from '@/components/forms/admin-contacts-reason-filter';
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

type ContactReasonFilter = 'all' | 'general' | 'press' | 'guest' | 'sponsorship' | 'other';

function normalizeReasonFilter(value: string | string[] | undefined): ContactReasonFilter {
  const raw = Array.isArray(value) ? value[0] : value;
  if (raw === 'general' || raw === 'press' || raw === 'guest' || raw === 'sponsorship' || raw === 'other') {
    return raw;
  }
  return 'all';
}

function reasonLabel(value: ContactSubmissionRow['reason']): string {
  if (value === 'guest') return 'Guest request';
  if (value === 'press') return 'Press / media';
  if (value === 'sponsorship') return 'Sponsorship';
  if (value === 'other') return 'Other';
  return 'General enquiry';
}

function reasonPillClass(value: ContactSubmissionRow['reason']): string {
  if (value === 'press') return 'bg-blue-100 text-blue-900 border-blue-300';
  if (value === 'guest') return 'bg-purple-100 text-purple-900 border-purple-300';
  if (value === 'sponsorship') return 'bg-emerald-100 text-emerald-900 border-emerald-300';
  if (value === 'other') return 'bg-slate-100 text-slate-900 border-slate-300';
  return 'bg-carnival-gold/20 text-carnival-ink border-carnival-gold/50';
}

export default async function AdminContactsPage({
  searchParams
}: {
  searchParams?: { reason?: string | string[] };
}) {
  noStore();

  if (!env.adminAuthDisabled && !isAdminSessionActive()) {
    redirect('/admin');
  }

  const selectedReasonFilter = normalizeReasonFilter(searchParams?.reason);

  const admin = createSupabaseAdminClient();
  let query = admin
    .from('contact_submissions')
    .select('id,name,email,reason,subject,message,status,created_at')
    .order('created_at', { ascending: false })
    .limit(150);

  if (selectedReasonFilter !== 'all') {
    query = query.eq('reason', selectedReasonFilter);
  }

  const { data, error } = await query;

  const rows = (data || []) as ContactSubmissionRow[];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-black">Contact Submissions</h1>
          <span className="rounded-full bg-carnival-red px-3 py-1 text-sm font-bold text-white">
            {rows.length}
          </span>
        </div>
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
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <AdminContactsReasonFilter value={selectedReasonFilter} />
        </div>

        <div className="space-y-3 md:hidden">
          {rows.map((row) => {
            const createdAt = new Date(row.created_at);
            const message = row.message || '';
            const hasLongMessage = message.length > 180 || message.includes('\n');

            return (
              <article key={row.id} className="rounded-xl border border-carnival-ink/15 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${reasonPillClass(row.reason)}`}>
                      {reasonLabel(row.reason)}
                    </span>
                    <p className="mt-3 text-xs font-semibold text-carnival-ink/55">
                      {createdAt.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                      })}{' '}
                      ·{' '}
                      {createdAt.toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <AdminContactDeleteButton submissionId={row.id} />
                </div>

                <div className="mt-2">
                  <p className="text-base font-bold text-carnival-ink">{row.name}</p>
                  <a href={`mailto:${row.email}`} className="mt-0.5 block text-sm underline underline-offset-2">
                    {row.email}
                  </a>
                </div>

                <details className="group mt-3">
                  <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
                    <p className="text-sm font-bold text-carnival-ink">{row.subject}</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-carnival-ink/80 line-clamp-3 group-open:hidden">
                      {message}
                    </p>
                    <p className="mt-1 hidden whitespace-pre-wrap text-sm leading-relaxed text-carnival-ink/85 group-open:block">
                      {message}
                    </p>
                    {hasLongMessage ? (
                      <>
                        <span className="mt-2 inline-block text-xs font-semibold text-carnival-red group-open:hidden">Show more</span>
                        <span className="mt-2 hidden text-xs font-semibold text-carnival-red group-open:inline">Show less</span>
                      </>
                    ) : null}
                  </summary>
                </details>
              </article>
            );
          })}

          {!rows.length && !error ? (
            <p className="rounded-lg border border-carnival-ink/15 bg-white p-6 text-center text-sm text-carnival-ink/70">
              No contact submissions yet.
            </p>
          ) : null}
        </div>

        <div className="hidden overflow-auto md:block">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-carnival-ink/15">
                <th className="py-3 pr-4">Date</th>
                <th className="py-3 pr-4 min-w-[170px]">Name</th>
                <th className="py-3 pr-4">Email</th>
                <th className="py-3 pr-4">Reason</th>
                <th className="py-3 pr-4">Subject & Message</th>
                <th className="py-3 pr-0 text-right"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const createdAt = new Date(row.created_at);
                const message = row.message || '';
                const hasLongMessage = message.length > 180 || message.includes('\n');

                return (
                  <tr key={row.id} className="border-b border-carnival-ink/10 align-top last:border-b-0">
                    <td className="py-4 pr-4 whitespace-nowrap">
                      <p className="font-semibold text-carnival-ink">
                        {createdAt.toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </p>
                      <p className="mt-0.5 text-xs text-carnival-ink/65">
                        {createdAt.toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })}
                      </p>
                    </td>

                    <td className="py-4 pr-4 min-w-[170px] font-semibold">{row.name}</td>

                    <td className="py-4 pr-4">
                      <a href={`mailto:${row.email}`} className="underline underline-offset-2">
                        {row.email}
                      </a>
                    </td>

                    <td className="py-4 pr-4 whitespace-nowrap">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${reasonPillClass(row.reason)}`}>
                        {reasonLabel(row.reason)}
                      </span>
                    </td>

                    <td className="py-4 pr-4 min-w-[360px]">
                      <details className="group">
                        <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
                          <p className="font-bold text-carnival-ink">{row.subject}</p>
                          <p className="mt-1 whitespace-pre-wrap leading-relaxed text-carnival-ink/80 line-clamp-3 group-open:hidden">
                            {message}
                          </p>
                          <p className="mt-1 hidden whitespace-pre-wrap leading-relaxed text-carnival-ink/85 group-open:block">
                            {message}
                          </p>
                          {hasLongMessage ? (
                            <>
                              <span className="mt-2 inline-block text-xs font-semibold text-carnival-red group-open:hidden">Show more</span>
                              <span className="mt-2 hidden text-xs font-semibold text-carnival-red group-open:inline">Show less</span>
                            </>
                          ) : null}
                        </summary>
                      </details>
                    </td>

                    <td className="py-4 pr-0 text-right">
                      <AdminContactDeleteButton submissionId={row.id} />
                    </td>
                  </tr>
                );
              })}

              {!rows.length && !error ? (
                <tr>
                  <td className="py-8 text-center text-sm text-carnival-ink/70" colSpan={6}>
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
