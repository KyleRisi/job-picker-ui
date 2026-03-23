import { unstable_noStore as noStore } from 'next/cache';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { WorkspaceFreakyRegisterActions } from '@/components/workspace/workspace-freaky-register-actions';
import {
  WorkspaceFreakyRegisterTable,
  type WorkspaceFreakyModerationRow
} from '@/components/workspace/workspace-freaky-register-table';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkspaceFreakyRegisterPage() {
  noStore();

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('freaky_suggestions')
    .select('id,title,description,status,is_visible,upvote_count,created_at,verification_completed_at,duplicate_of_suggestion_id,submitted_by_identity_id,submitted_name,submitted_full_name,submitted_country,topic_term_id,topic_slug,topic_name,covered_episode_id,covered_at,covered_episode:covered_episode_id(id,title,slug,published_at),freaky_identities!freaky_suggestions_submitted_by_identity_id_fkey(id,email,email_verified_at,is_blocked,blocked_at,block_reason)')
    .order('created_at', { ascending: false })
    .limit(250);

  const rows: WorkspaceFreakyModerationRow[] = ((data || []) as Array<Record<string, unknown>>).map((row) => {
    const identityRaw = row.freaky_identities;
    const coveredEpisodeRaw = row.covered_episode;
    const identity = Array.isArray(identityRaw)
      ? ((identityRaw[0] || null) as WorkspaceFreakyModerationRow['freaky_identities'])
      : (identityRaw as WorkspaceFreakyModerationRow['freaky_identities']);
    const coveredEpisode = Array.isArray(coveredEpisodeRaw)
      ? ((coveredEpisodeRaw[0] || null) as WorkspaceFreakyModerationRow['covered_episode'])
      : (coveredEpisodeRaw as WorkspaceFreakyModerationRow['covered_episode']);

    return {
      id: `${row.id || ''}`,
      title: `${row.title || ''}`,
      description: `${row.description || ''}`,
      status: `${row.status || ''}`,
      is_visible: row.is_visible === true,
      upvote_count: Number(row.upvote_count || 0),
      created_at: `${row.created_at || ''}`,
      verification_completed_at: row.verification_completed_at ? `${row.verification_completed_at}` : null,
      duplicate_of_suggestion_id: row.duplicate_of_suggestion_id ? `${row.duplicate_of_suggestion_id}` : null,
      submitted_by_identity_id: row.submitted_by_identity_id ? `${row.submitted_by_identity_id}` : null,
      submitted_name: `${row.submitted_name || ''}`,
      submitted_full_name: `${row.submitted_full_name || ''}`,
      submitted_country: `${row.submitted_country || ''}`,
      topic_term_id: row.topic_term_id ? `${row.topic_term_id}` : null,
      topic_slug: `${row.topic_slug || ''}`,
      topic_name: `${row.topic_name || ''}`,
      covered_episode_id: row.covered_episode_id ? `${row.covered_episode_id}` : null,
      covered_at: row.covered_at ? `${row.covered_at}` : null,
      covered_episode: coveredEpisode
        ? {
          id: `${coveredEpisode.id || ''}`,
          title: `${coveredEpisode.title || ''}`,
          slug: `${coveredEpisode.slug || ''}`,
          published_at: coveredEpisode.published_at ? `${coveredEpisode.published_at}` : null
        }
        : null,
      freaky_identities: identity
    };
  });

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Freaky Register</h1>
          <p className="text-sm text-slate-600">Moderate suggestions, manage duplicates, and block abusive identities.</p>
        </div>
        <WorkspaceFreakyRegisterActions />
      </header>

      {error ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Unable to load Freaky Register data. Ensure migration `0030_create_freaky_register.sql` has been applied.
        </p>
      ) : null}

      <WorkspaceFreakyRegisterTable rows={rows} />
    </section>
  );
}
