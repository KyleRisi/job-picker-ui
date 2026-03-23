import { createSupabaseAdminClient } from '@/lib/supabase';
import {
  type EpisodeEditorialApplyInput,
  type EpisodeEditorialWritePayload,
  isEpisodeEditorialPayload,
  normalizeEpisodeDraftTitle,
  prepareEpisodeEditorialApplyInput
} from '@/lib/episode-editorial';
import { buildSeoChecklist, normalizeBlogDocument } from '@/lib/blog/content';
import { hasTranscriptContent } from '@/lib/podcast-shared';

export const PREPUBLISH_DRAFT_STATUSES = [
  'draft',
  'ready_to_match',
  'needs_review',
  'conflict',
  'attached',
  'archived'
] as const;

export type PrepublishDraftStatus = (typeof PREPUBLISH_DRAFT_STATUSES)[number];

export type PrepublishDraft = {
  id: string;
  title: string;
  normalizedTitle: string;
  status: PrepublishDraftStatus;
  reviewReason: string | null;
  candidateEpisodeIds: string[];
  matchedEpisodeId: string | null;
  matchedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  updatedBy: string | null;
  readyToMatchAt: string | null;
  readyToMatchBy: string | null;
  lastMatchAttemptAt: string | null;
  matchAttemptCount: number;
  attachMethod: 'auto' | 'manual' | 'conflict_resolution' | 'rollback' | null;
  attachedBy: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  archivedAt: string | null;
  sourceHint: string | null;
  expectedPublishDate: string | null;
  manualMatchNotes: string;
  episodeNumberHint: number | null;
  seriesNameHint: string | null;
  partNumberHint: number | null;
  alternateTitles: string[];
  allowTitleCollision: boolean;
  editorialPayload: {
    editorial: EpisodeEditorialApplyInput['editorial'];
    discovery: EpisodeEditorialApplyInput['discoveryRows'];
    relatedEpisodes: EpisodeEditorialApplyInput['relatedEpisodeRows'];
    relatedPosts: EpisodeEditorialApplyInput['relatedPostRows'];
  };
};

export type EpisodeWorkspaceRow =
  | {
      rowType: 'live_episode';
      id: string;
      slug: string;
      title: string;
      publishedAt: string;
      episodeNumber: number | null;
      seasonNumber: number | null;
      duration: string | null;
      artworkUrl: string | null;
      audioUrl: string;
      sourceUrl: string | null;
      primaryTopicName?: string | null;
      seoTitle?: string | null;
      metaDescription?: string | null;
      seoScore?: number | null;
      hasTranscript?: boolean;
    }
  | {
      rowType: 'prepublish_draft';
      id: string;
      title: string;
      normalizedTitle: string;
      status: PrepublishDraftStatus;
      reviewReason: string | null;
      matchedEpisodeId: string | null;
      updatedAt: string;
      expectedPublishDate: string | null;
      allowTitleCollision: boolean;
      primaryTopicName?: string | null;
      seoTitle?: string | null;
      metaDescription?: string | null;
      seoScore?: number | null;
      hasTranscript?: boolean;
      artworkUrl?: string | null;
    };

type SupabaseClient = ReturnType<typeof createSupabaseAdminClient>;

type DraftRow = {
  id: string;
  title: string;
  normalized_title: string;
  status: PrepublishDraftStatus;
  review_reason: string | null;
  candidate_episode_ids: string[] | null;
  matched_episode_id: string | null;
  matched_at: string | null;
  editorial_payload: any;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  ready_to_match_at: string | null;
  ready_to_match_by: string | null;
  last_match_attempt_at: string | null;
  match_attempt_count: number;
  attach_method: 'auto' | 'manual' | 'conflict_resolution' | 'rollback' | null;
  attached_by: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  archived_at: string | null;
  source_hint: string | null;
  expected_publish_date: string | null;
  manual_match_notes: string | null;
  episode_number_hint: number | null;
  series_name_hint: string | null;
  part_number_hint: number | null;
  alternate_titles: unknown;
  allow_title_collision: boolean;
};

function isDraftStatus(value: string): value is PrepublishDraftStatus {
  return PREPUBLISH_DRAFT_STATUSES.includes(value as PrepublishDraftStatus);
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.map((item) => `${item || ''}`.trim()).filter(Boolean);
}

function serializeApplyInput(applyInput: EpisodeEditorialApplyInput) {
  return {
    editorial: applyInput.editorial,
    discovery: applyInput.discoveryRows,
    relatedEpisodes: applyInput.relatedEpisodeRows,
    relatedPosts: applyInput.relatedPostRows
  };
}

function mapDraftRow(row: DraftRow): PrepublishDraft {
  const payload = row.editorial_payload || {};
  return {
    id: row.id,
    title: row.title,
    normalizedTitle: row.normalized_title,
    status: isDraftStatus(row.status) ? row.status : 'draft',
    reviewReason: row.review_reason,
    candidateEpisodeIds: Array.isArray(row.candidate_episode_ids) ? row.candidate_episode_ids : [],
    matchedEpisodeId: row.matched_episode_id,
    matchedAt: row.matched_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    readyToMatchAt: row.ready_to_match_at,
    readyToMatchBy: row.ready_to_match_by,
    lastMatchAttemptAt: row.last_match_attempt_at,
    matchAttemptCount: row.match_attempt_count || 0,
    attachMethod: row.attach_method,
    attachedBy: row.attached_by,
    resolvedBy: row.resolved_by,
    resolvedAt: row.resolved_at,
    archivedAt: row.archived_at,
    sourceHint: row.source_hint,
    expectedPublishDate: row.expected_publish_date,
    manualMatchNotes: row.manual_match_notes || '',
    episodeNumberHint: row.episode_number_hint,
    seriesNameHint: row.series_name_hint,
    partNumberHint: row.part_number_hint,
    alternateTitles: toStringArray(row.alternate_titles),
    allowTitleCollision: row.allow_title_collision,
    editorialPayload: {
      editorial: payload.editorial || {},
      discovery: Array.isArray(payload.discovery) ? payload.discovery : [],
      relatedEpisodes: Array.isArray(payload.relatedEpisodes) ? payload.relatedEpisodes : [],
      relatedPosts: Array.isArray(payload.relatedPosts) ? payload.relatedPosts : []
    }
  };
}

export async function listPrepublishDrafts(input?: {
  includeArchived?: boolean;
  q?: string;
  limit?: number;
}) {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('podcast_episode_prepublish_drafts')
    .select('*')
    .order('updated_at', { ascending: false });

  if (!input?.includeArchived) {
    query = query.neq('status', 'archived');
  }

  const normalizedQ = `${input?.q || ''}`.trim();
  if (normalizedQ) {
    const escaped = normalizedQ.replace(/"/g, '');
    query = query.or(`title.ilike.%${escaped}%,normalized_title.ilike.%${escaped}%`);
  }

  if (typeof input?.limit === 'number' && input.limit > 0) {
    query = query.limit(input.limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return ((data || []) as DraftRow[]).map(mapDraftRow);
}

export async function listWorkspacePrepublishDraftRows(input?: {
  includeArchived?: boolean;
  q?: string;
}) {
  const drafts = await listPrepublishDrafts({
    includeArchived: input?.includeArchived,
    q: input?.q,
    limit: 500
  });

  const primaryTopicTermIds = Array.from(new Set(
    drafts
      .map((draft) => {
        const discoveryRows = Array.isArray(draft.editorialPayload.discovery) ? draft.editorialPayload.discovery : [];
        return discoveryRows.find((row) => row.isPrimary)?.termId || null;
      })
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
  ));

  const topicNameById = new Map<string, string>();
  if (primaryTopicTermIds.length) {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('discovery_terms')
      .select('id,name,term_type')
      .in('id', primaryTopicTermIds);
    if (!error) {
      for (const row of (data || []) as Array<{ id: string; name: string; term_type: string }>) {
        if (row.term_type === 'topic') topicNameById.set(row.id, row.name);
      }
    }
  }

  return drafts.map((draft) => ({
    ...(() => {
      const editorial = draft.editorialPayload.editorial || {};
      const bodyDocument = normalizeBlogDocument((editorial as { bodyJson?: unknown }).bodyJson);
      const discoveryRows = Array.isArray(draft.editorialPayload.discovery) ? draft.editorialPayload.discovery : [];
      const primaryTopicId = discoveryRows.find((row) => row.isPrimary)?.termId || null;
      const seo = buildSeoChecklist({
        title: `${(editorial as { webTitle?: string | null }).webTitle || draft.title || ''}`.trim() || 'Untitled Episode',
        seoTitle: (editorial as { seoTitle?: string | null }).seoTitle || null,
        seoDescription: (editorial as { metaDescription?: string | null }).metaDescription || null,
        focusKeyword: (editorial as { focusKeyword?: string | null }).focusKeyword || null,
        canonicalUrl: (editorial as { canonicalUrlOverride?: string | null }).canonicalUrlOverride || null,
        document: bodyDocument,
        excerpt: (editorial as { excerpt?: string | null }).excerpt || null,
        hasAuthor: Boolean((editorial as { authorId?: string | null }).authorId),
        hasPrimaryCategory: Boolean(primaryTopicId),
        hasLinkedEpisode: Array.isArray(draft.editorialPayload.relatedEpisodes) && draft.editorialPayload.relatedEpisodes.length > 0
      });
      return {
        primaryTopicName: primaryTopicId ? topicNameById.get(primaryTopicId) || null : null,
        seoTitle: (editorial as { seoTitle?: string | null }).seoTitle || null,
        metaDescription: (editorial as { metaDescription?: string | null }).metaDescription || null,
        seoScore: seo.score,
        hasTranscript: hasTranscriptContent((editorial as { bodyJson?: unknown }).bodyJson),
        artworkUrl: (editorial as { heroImageUrl?: string | null }).heroImageUrl || null
      };
    })(),
    rowType: 'prepublish_draft' as const,
    id: draft.id,
    title: draft.title,
    normalizedTitle: draft.normalizedTitle,
    status: draft.status,
    reviewReason: draft.reviewReason,
    matchedEpisodeId: draft.matchedEpisodeId,
    updatedAt: draft.updatedAt,
    expectedPublishDate: draft.expectedPublishDate,
    allowTitleCollision: draft.allowTitleCollision
  }));
}

export async function getPrepublishDraftById(id: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('podcast_episode_prepublish_drafts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapDraftRow(data as DraftRow);
}

export async function createPrepublishDraft(input: {
  title: string;
  actor: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const title = `${input.title || ''}`.trim() || 'Untitled episode draft';
  const normalizedTitle = normalizeEpisodeDraftTitle(title);

  const { data, error } = await supabase
    .from('podcast_episode_prepublish_drafts')
    .insert({
      title,
      normalized_title: normalizedTitle,
      status: 'draft',
      editorial_payload: {
        editorial: {
          webTitle: title,
          isVisible: true,
          isArchived: false
        },
        discovery: [],
        relatedEpisodes: [],
        relatedPosts: []
      },
      created_by: input.actor,
      updated_by: input.actor
    })
    .select('*')
    .single();
  if (error) throw error;
  return mapDraftRow(data as DraftRow);
}

export async function updatePrepublishDraftFromEditorialPayload(input: {
  id: string;
  payload: EpisodeEditorialWritePayload;
  actor: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const current = await getPrepublishDraftById(input.id);
  if (!current) return null;

  const applyInput = await prepareEpisodeEditorialApplyInput({
    supabase,
    episodeId: current.matchedEpisodeId || '00000000-0000-0000-0000-000000000000',
    payload: input.payload
  });

  const draftTitle = `${applyInput.editorial.webTitle || current.title || ''}`.trim() || current.title;
  const normalizedTitle = normalizeEpisodeDraftTitle(draftTitle);

  const { data, error } = await supabase
    .from('podcast_episode_prepublish_drafts')
    .update({
      title: draftTitle,
      normalized_title: normalizedTitle,
      editorial_payload: serializeApplyInput(applyInput),
      updated_by: input.actor,
      updated_at: new Date().toISOString()
    })
    .eq('id', input.id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapDraftRow(data as DraftRow);
}

export async function updatePrepublishDraftWorkflow(input: {
  id: string;
  actor: string | null;
  status?: PrepublishDraftStatus;
  reviewReason?: string | null;
  manualMatchNotes?: string | null;
  sourceHint?: string | null;
  expectedPublishDate?: string | null;
  episodeNumberHint?: number | null;
  seriesNameHint?: string | null;
  partNumberHint?: number | null;
  allowTitleCollision?: boolean;
  confirmAllowTitleCollision?: boolean;
  allowTitleCollisionNote?: string | null;
  archive?: boolean;
  unarchive?: boolean;
}) {
  const supabase = createSupabaseAdminClient();

  const current = await getPrepublishDraftById(input.id);
  if (!current) return null;

  const patch: Record<string, unknown> = {
    updated_by: input.actor,
    updated_at: new Date().toISOString()
  };

  if (typeof input.status === 'string') {
    patch.status = input.status;
    if (input.status === 'ready_to_match') {
      patch.ready_to_match_at = new Date().toISOString();
      patch.ready_to_match_by = input.actor;
      patch.archived_at = null;
    }
    if (input.status === 'archived') {
      patch.archived_at = new Date().toISOString();
    }
  }

  if (input.archive === true) {
    patch.status = 'archived';
    patch.archived_at = new Date().toISOString();
  }
  if (input.unarchive === true) {
    patch.status = 'draft';
    patch.archived_at = null;
  }

  if (typeof input.reviewReason === 'string' || input.reviewReason === null) {
    patch.review_reason = input.reviewReason;
  }
  if (typeof input.manualMatchNotes === 'string') {
    patch.manual_match_notes = input.manualMatchNotes;
  }
  if (typeof input.sourceHint === 'string' || input.sourceHint === null) {
    patch.source_hint = input.sourceHint;
  }
  if (typeof input.expectedPublishDate === 'string' || input.expectedPublishDate === null) {
    patch.expected_publish_date = input.expectedPublishDate;
  }
  if (typeof input.episodeNumberHint === 'number' || input.episodeNumberHint === null) {
    patch.episode_number_hint = input.episodeNumberHint;
  }
  if (typeof input.seriesNameHint === 'string' || input.seriesNameHint === null) {
    patch.series_name_hint = input.seriesNameHint;
  }
  if (typeof input.partNumberHint === 'number' || input.partNumberHint === null) {
    patch.part_number_hint = input.partNumberHint;
  }

  if (typeof input.allowTitleCollision === 'boolean') {
    const enablingCollision = input.allowTitleCollision === true && current.allowTitleCollision === false;
    if (enablingCollision) {
      const note = `${input.allowTitleCollisionNote || ''}`.trim();
      if (input.confirmAllowTitleCollision !== true || !note) {
        throw new Error('Enabling title collision requires explicit confirmation and a short note.');
      }
      const stampedNote = `${current.manualMatchNotes ? `${current.manualMatchNotes}\n` : ''}[${new Date().toISOString()}] Collision override by ${input.actor || 'unknown'}: ${note}`;
      patch.manual_match_notes = stampedNote;
    }
    patch.allow_title_collision = input.allowTitleCollision;
  }

  const { data, error } = await supabase
    .from('podcast_episode_prepublish_drafts')
    .update(patch)
    .eq('id', input.id)
    .select('*')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapDraftRow(data as DraftRow);
}

export async function attachPrepublishDraft(input: {
  draftId: string;
  episodeId: string;
  actor: string | null;
  method?: 'auto' | 'manual' | 'conflict_resolution';
  forceConflict?: boolean;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('attach_prepublish_draft_to_episode', {
    p_draft_id: input.draftId,
    p_episode_id: input.episodeId,
    p_actor: input.actor,
    p_attach_method: input.method || 'manual',
    p_force_conflict: input.forceConflict === true
  });
  if (error) throw error;
  return (data || {}) as {
    status: 'attached' | 'conflict' | 'not_found' | 'invalid' | 'terminal';
    error?: string;
    episodeId?: string;
    snapshotId?: string;
    draftStatus?: string;
  };
}

export async function restoreEpisodeStateFromSnapshot(input: {
  snapshotId: string;
  actor: string | null;
  force?: boolean;
  restoreNote?: string | null;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('restore_episode_state_from_attach_snapshot', {
    p_snapshot_id: input.snapshotId,
    p_actor: input.actor,
    p_force: input.force === true,
    p_restore_note: input.restoreNote || null
  });
  if (error) throw error;
  return (data || {}) as {
    status: 'restored' | 'stale' | 'not_found';
    error?: string;
    episodeId?: string;
    snapshotId?: string;
    snapshotFingerprint?: string;
    currentFingerprint?: string;
    forced?: boolean;
  };
}

export async function listDraftSnapshots(draftId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('podcast_episode_attach_snapshots')
    .select('id,draft_id,episode_id,attach_method,actor_id,created_at,editorial_before_updated_at,state_fingerprint,restored_at,restored_by,restore_note')
    .eq('draft_id', draftId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function runPrepublishDraftMatcher() {
  const supabase = createSupabaseAdminClient();
  const drafts = await listPrepublishDrafts({ includeArchived: false, limit: 500 });
  const readyDrafts = drafts.filter((draft) => draft.status === 'ready_to_match' && !draft.archivedAt);

  const { data: episodes, error: episodesError } = await supabase
    .from('podcast_episodes')
    .select('id,title,is_archived')
    .eq('is_archived', false)
    .limit(1000);
  if (episodesError) throw episodesError;

  const titleMap = new Map<string, string[]>();
  for (const row of (episodes || []) as Array<{ id: string; title: string; is_archived: boolean }>) {
    const key = normalizeEpisodeDraftTitle(row.title || '');
    if (!key) continue;
    const list = titleMap.get(key) || [];
    list.push(row.id);
    titleMap.set(key, list);
  }

  const results = {
    considered: readyDrafts.length,
    attached: 0,
    noMatch: 0,
    ambiguous: 0,
    conflicts: 0,
    failed: 0
  };

  for (const draft of readyDrafts) {
    try {
      const nowIso = new Date().toISOString();
      const matches = titleMap.get(draft.normalizedTitle) || [];

      if (matches.length === 0) {
        const { error } = await supabase
          .from('podcast_episode_prepublish_drafts')
          .update({
            last_match_attempt_at: nowIso,
            match_attempt_count: draft.matchAttemptCount + 1,
            updated_at: nowIso
          })
          .eq('id', draft.id);
        if (error) throw error;
        results.noMatch += 1;
        continue;
      }

      if (matches.length > 1) {
        const { error } = await supabase
          .from('podcast_episode_prepublish_drafts')
          .update({
            status: 'needs_review',
            review_reason: 'Multiple RSS episodes matched this title. Manual review required.',
            candidate_episode_ids: matches,
            last_match_attempt_at: nowIso,
            match_attempt_count: draft.matchAttemptCount + 1,
            updated_at: nowIso
          })
          .eq('id', draft.id);
        if (error) throw error;
        results.ambiguous += 1;
        continue;
      }

      const attachResult = await attachPrepublishDraft({
        draftId: draft.id,
        episodeId: matches[0],
        actor: 'system-matcher',
        method: 'auto',
        forceConflict: false
      });

      if (attachResult.status === 'attached') {
        results.attached += 1;
        continue;
      }
      if (attachResult.status === 'conflict') {
        results.conflicts += 1;
        continue;
      }

      results.failed += 1;
    } catch (error) {
      results.failed += 1;
      console.error('[prepublish matcher] failed draft', draft.id, error);
    }
  }

  return results;
}

export function isPrepublishDraftPayload(value: unknown): value is EpisodeEditorialWritePayload {
  return isEpisodeEditorialPayload(value);
}
