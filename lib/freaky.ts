import { createHash, randomBytes } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { normalizeEmail } from '@/lib/utils';

export type FreakySort = 'top' | 'newest';
export type FreakySuggestionBucket = 'open' | 'covered' | 'all';
export type FreakyVerificationPurpose = 'publish_suggestion' | 'cast_vote';
export type FreakySuggestionStatus =
  | 'pending_verification'
  | 'published'
  | 'hidden'
  | 'spam'
  | 'removed'
  | 'duplicate'
  | 'expired_unverified';

export type FreakyPublicSuggestion = {
  type: 'open_suggestion';
  id: string;
  title: string;
  description: string;
  topicName: string;
  upvoteCount: number;
  createdAt: string;
  isCovered: boolean;
  coveredAt: string | null;
  coveredEpisode: {
    id: string;
    slug: string;
    title: string;
    publishedAt: string | null;
    artworkUrl: string | null;
  } | null;
};

export type FreakyCoveredEpisodeSuggestion = {
  type: 'covered_episode';
  coveredEpisode: {
    id: string;
    slug: string;
    title: string;
    publishedAt: string | null;
    artworkUrl: string | null;
  };
  coveredAt: string | null;
  linkedContributors: Array<{
    fullName: string;
    country: string;
  }>;
  linkedSuggestionCount: number;
  totalVotes: number;
};

export type FreakySuggestionsListResult = {
  bucket: FreakySuggestionBucket;
  openItems: FreakyPublicSuggestion[];
  coveredItems: FreakyCoveredEpisodeSuggestion[];
  hasMoreOpen: boolean;
  hasMoreCovered: boolean;
};

export type FreakyTopicOption = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
};

export type FreakyIdentity = {
  id: string;
  email: string;
  email_normalized: string;
  email_verified_at: string | null;
  is_blocked: boolean;
  blocked_at: string | null;
  block_reason: string;
};

export type FreakyVerificationTokenRow = {
  id: string;
  purpose: FreakyVerificationPurpose;
  identity_id: string;
  suggestion_id: string | null;
  expires_at: string;
  consumed_at: string | null;
  created_at: string;
};

export function normalizeFreakyTitle(value: string): string {
  return `${value || ''}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeFreakyText(value: string): string {
  return `${value || ''}`.replace(/\s+/g, ' ').trim();
}

function mapPublicSuggestion(row: {
  id: string;
  title: string;
  description: string;
  topic_name: string;
  upvote_count: number;
  created_at: string;
  covered_episode_id?: string | null;
  covered_at?: string | null;
  podcast_episodes?: {
    id?: string;
    slug?: string;
    title?: string;
    published_at?: string | null;
    artwork_url?: string | null;
  } | Array<{
    id?: string;
    slug?: string;
    title?: string;
    published_at?: string | null;
    artwork_url?: string | null;
  }> | null;
}): FreakyPublicSuggestion {
  const linkedEpisode = Array.isArray(row.podcast_episodes)
    ? (row.podcast_episodes[0] || null)
    : (row.podcast_episodes || null);
  const isCovered = Boolean(row.covered_episode_id);

  return {
    type: 'open_suggestion',
    id: row.id,
    title: row.title,
    description: row.description,
    topicName: row.topic_name || '',
    upvoteCount: row.upvote_count,
    createdAt: row.created_at,
    isCovered,
    coveredAt: row.covered_at || null,
    coveredEpisode: linkedEpisode && linkedEpisode.id ? {
      id: linkedEpisode.id,
      slug: linkedEpisode.slug || '',
      title: linkedEpisode.title || 'Episode',
      publishedAt: linkedEpisode.published_at || null,
      artworkUrl: linkedEpisode.artwork_url || null
    } : null
  };
}

function normalizeFreakySearchText(value: string): string {
  return normalizeFreakyText(value).toLowerCase();
}

function mapCoveredEpisodes(rows: Array<{
  covered_episode_id?: string | null;
  covered_at?: string | null;
  upvote_count?: number | null;
  submitted_full_name?: string | null;
  submitted_country?: string | null;
  podcast_episodes?: {
    id?: string;
    slug?: string;
    title?: string;
    published_at?: string | null;
    artwork_url?: string | null;
  } | Array<{
    id?: string;
    slug?: string;
    title?: string;
    published_at?: string | null;
    artwork_url?: string | null;
  }> | null;
}>, query: string): FreakyCoveredEpisodeSuggestion[] {
  const byEpisodeId = new Map<string, FreakyCoveredEpisodeSuggestion>();

  for (const row of rows) {
    const linkedEpisode = Array.isArray(row.podcast_episodes)
      ? (row.podcast_episodes[0] || null)
      : (row.podcast_episodes || null);
    const episodeId = linkedEpisode?.id || row.covered_episode_id || null;
    if (!episodeId) continue;

    const existing = byEpisodeId.get(episodeId);
    if (!existing) {
      byEpisodeId.set(episodeId, {
        type: 'covered_episode',
        coveredEpisode: {
          id: episodeId,
          slug: linkedEpisode?.slug || '',
          title: linkedEpisode?.title || 'Episode',
          publishedAt: linkedEpisode?.published_at || null,
          artworkUrl: linkedEpisode?.artwork_url || null
        },
        coveredAt: row.covered_at || null,
        linkedContributors: [],
        linkedSuggestionCount: 0,
        totalVotes: 0
      });
    }

    const target = byEpisodeId.get(episodeId);
    if (!target) continue;
    target.linkedSuggestionCount += 1;
    target.totalVotes += Number(row.upvote_count || 0);
    if (!target.coveredAt || (row.covered_at && row.covered_at > target.coveredAt)) {
      target.coveredAt = row.covered_at || target.coveredAt;
    }

    const fullName = normalizeFreakyText(row.submitted_full_name || '');
    const country = normalizeFreakyText(row.submitted_country || '');
    if (!fullName && !country) continue;
    const contributorKey = `${fullName.toLowerCase()}::${country.toLowerCase()}`;
    const alreadyPresent = target.linkedContributors.some((item) => {
      return `${item.fullName.toLowerCase()}::${item.country.toLowerCase()}` === contributorKey;
    });
    if (!alreadyPresent) {
      target.linkedContributors.push({
        fullName: fullName || 'Unknown',
        country: country || 'Unknown'
      });
    }
  }

  const grouped = Array.from(byEpisodeId.values())
    .sort((a, b) => {
      const aTime = a.coveredAt ? new Date(a.coveredAt).getTime() : 0;
      const bTime = b.coveredAt ? new Date(b.coveredAt).getTime() : 0;
      if (aTime !== bTime) return bTime - aTime;
      return a.coveredEpisode.title.localeCompare(b.coveredEpisode.title, 'en-GB');
    });

  if (!query) return grouped;

  const normalizedQuery = normalizeFreakySearchText(query);
  return grouped.filter((item) => {
    const titleMatch = normalizeFreakySearchText(item.coveredEpisode.title).includes(normalizedQuery);
    if (titleMatch) return true;
    return item.linkedContributors.some((person) => {
      const fullNameMatch = normalizeFreakySearchText(person.fullName).includes(normalizedQuery);
      const countryMatch = normalizeFreakySearchText(person.country).includes(normalizedQuery);
      return fullNameMatch || countryMatch;
    });
  });
}

export async function listActiveFreakyTopics(): Promise<FreakyTopicOption[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('discovery_terms')
    .select('id,name,slug,sort_order')
    .eq('term_type', 'topic')
    .eq('is_active', true)
    .order('sort_order', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true });

  if (error) throw error;

  return ((data || []) as Array<{
    id: string;
    name: string;
    slug: string;
    sort_order: number | null;
  }>)
    .map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      sortOrder: Number(row.sort_order || 0)
    }))
    .sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.name.localeCompare(b.name, 'en-GB');
    });
}

export async function getActiveFreakyTopicById(topicTermId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('discovery_terms')
    .select('id,name,slug,term_type,is_active')
    .eq('id', topicTermId)
    .eq('term_type', 'topic')
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id as string,
    name: data.name as string,
    slug: data.slug as string
  };
}

export async function listFreakySuggestions(input: {
  query?: string;
  sort?: FreakySort;
  bucket?: FreakySuggestionBucket;
  limit?: number;
  offset?: number;
}): Promise<FreakySuggestionsListResult> {
  const supabase = createSupabaseAdminClient();
  const query = normalizeFreakyText(input.query || '');
  const sort = input.sort === 'newest' ? 'newest' : 'top';
  const bucket: FreakySuggestionBucket = input.bucket === 'covered' || input.bucket === 'all' ? input.bucket : 'open';
  const limit = Number.isFinite(input.limit) ? Math.max(1, Math.min(100, Number(input.limit))) : 50;
  const offset = Number.isFinite(input.offset) ? Math.max(0, Number(input.offset)) : 0;

  const fetchOpen = bucket === 'open' || bucket === 'all';
  const fetchCovered = bucket === 'covered' || bucket === 'all';

  let openItems: FreakyPublicSuggestion[] = [];
  let hasMoreOpen = false;
  if (fetchOpen) {
    let openQuery = supabase
      .from('freaky_suggestions')
      .select('id,title,description,topic_name,upvote_count,created_at,covered_episode_id,covered_at,podcast_episodes:covered_episode_id(id,slug,title,published_at,artwork_url)')
      .eq('is_visible', true)
      .eq('status', 'published')
      .is('covered_episode_id', null);

    if (query) {
      const escaped = query.replace(/,/g, ' ');
      openQuery = openQuery.or(`title.ilike.%${escaped}%,description.ilike.%${escaped}%`);
    }

    if (sort === 'newest') {
      openQuery = openQuery.order('created_at', { ascending: false });
    } else {
      openQuery = openQuery.order('upvote_count', { ascending: false }).order('created_at', { ascending: false });
    }

    const { data, error } = await openQuery.range(offset, offset + limit);
    if (error) throw error;
    const mapped = (data || []).map((row) => mapPublicSuggestion(row as never));
    openItems = mapped.slice(0, limit);
    hasMoreOpen = mapped.length > limit;
  }

  let coveredItems: FreakyCoveredEpisodeSuggestion[] = [];
  let hasMoreCovered = false;
  if (fetchCovered) {
    const coveredQuery = supabase
      .from('freaky_suggestions')
      .select('covered_episode_id,covered_at,upvote_count,submitted_full_name,submitted_country,podcast_episodes:covered_episode_id(id,slug,title,published_at,artwork_url)')
      .eq('is_visible', true)
      .eq('status', 'published')
      .not('covered_episode_id', 'is', null)
      .order('covered_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    const { data, error } = await coveredQuery;
    if (error) throw error;
    const grouped = mapCoveredEpisodes((data || []) as never, query);
    coveredItems = grouped.slice(offset, offset + limit);
    hasMoreCovered = grouped.length > offset + limit;
  }

  return {
    bucket,
    openItems,
    coveredItems,
    hasMoreOpen,
    hasMoreCovered
  };
}

export async function findSimilarFreakySuggestions(title: string, limit = 5) {
  const supabase = createSupabaseAdminClient();
  const normalized = normalizeFreakyTitle(title);
  if (!normalized) return [];

  const exact = await supabase
    .from('freaky_suggestions')
    .select('id,title,description,topic_name,upvote_count,created_at')
    .eq('is_visible', true)
    .eq('status', 'published')
    .eq('title_normalized', normalized)
    .order('upvote_count', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(3);

  if (exact.error) throw exact.error;
  const exactRows = (exact.data || []).map((row) => ({
    ...(mapPublicSuggestion(row as never)),
    isExact: true,
    similarity: 1
  }));

  const fuzzy = await supabase.rpc('freaky_find_similar_suggestions', {
    p_title: title,
    p_limit: Math.max(1, Math.min(10, limit))
  });
  if (fuzzy.error) throw fuzzy.error;

  const fuzzyRows = ((fuzzy.data || []) as Array<{
    id: string;
    title: string;
    description: string;
    upvote_count: number;
    created_at: string;
    is_exact: boolean;
    similarity_score: number;
  }>).map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    topicName: '',
    upvoteCount: row.upvote_count,
    createdAt: row.created_at,
    isExact: row.is_exact,
    similarity: row.similarity_score || 0
  }));

  const byId = new Map<string, (typeof fuzzyRows)[number]>();
  [...exactRows, ...fuzzyRows].forEach((row) => {
    if (!byId.has(row.id)) byId.set(row.id, row);
  });

  return Array.from(byId.values())
    .sort((a, b) => {
      if (a.isExact !== b.isExact) return a.isExact ? -1 : 1;
      if (a.similarity !== b.similarity) return b.similarity - a.similarity;
      if (a.upvoteCount !== b.upvoteCount) return b.upvoteCount - a.upvoteCount;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .slice(0, limit);
}

export async function getFreakyIdentityById(identityId: string): Promise<FreakyIdentity | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('freaky_identities')
    .select('id,email,email_normalized,email_verified_at,is_blocked,blocked_at,block_reason')
    .eq('id', identityId)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as FreakyIdentity | null;
}

export async function getOrCreateFreakyIdentity(emailInput: string): Promise<FreakyIdentity> {
  const supabase = createSupabaseAdminClient();
  const email = normalizeEmail(emailInput);

  const existing = await supabase
    .from('freaky_identities')
    .select('id,email,email_normalized,email_verified_at,is_blocked,blocked_at,block_reason')
    .eq('email_normalized', email)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data as FreakyIdentity;

  const inserted = await supabase
    .from('freaky_identities')
    .insert({
      email,
      email_normalized: email
    })
    .select('id,email,email_normalized,email_verified_at,is_blocked,blocked_at,block_reason')
    .single();

  if (inserted.error || !inserted.data) {
    throw inserted.error || new Error('Failed to create freaky identity.');
  }

  return inserted.data as FreakyIdentity;
}

export async function markFreakyIdentityVerified(identityId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('freaky_identities')
    .update({ email_verified_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
    .eq('id', identityId);

  if (error) throw error;
}

export async function touchFreakyIdentity(identityId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('freaky_identities')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', identityId);
  if (error) throw error;
}

export async function createPendingFreakySuggestion(input: {
  identityId: string;
  submittedName: string;
  submittedFullName: string;
  submittedCountry: string;
  topicTermId: string;
  topicSlug: string;
  topicName: string;
  title: string;
  description: string;
}) {
  const supabase = createSupabaseAdminClient();
  const submittedName = normalizeFreakyText(input.submittedName);
  const submittedFullName = normalizeFreakyText(input.submittedFullName);
  const submittedCountry = normalizeFreakyText(input.submittedCountry);
  const title = normalizeFreakyText(input.title);
  const description = normalizeFreakyText(input.description);
  const titleNormalized = normalizeFreakyTitle(input.title);

  const { data, error } = await supabase
    .from('freaky_suggestions')
    .insert({
      title,
      title_normalized: titleNormalized,
      description,
      submitted_name: submittedName,
      submitted_full_name: submittedFullName,
      submitted_country: submittedCountry,
      topic_term_id: input.topicTermId,
      topic_slug: input.topicSlug,
      topic_name: input.topicName,
      status: 'pending_verification',
      is_visible: false,
      submitted_by_identity_id: input.identityId
    })
    .select('id,title,description,topic_name,upvote_count,created_at')
    .single();

  if (error || !data) throw error || new Error('Failed to create suggestion.');
  return mapPublicSuggestion(data as never);
}

export async function publishFreakySuggestion(suggestionId: string) {
  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('freaky_suggestions')
    .update({
      status: 'published',
      is_visible: true,
      verification_completed_at: now
    })
    .eq('id', suggestionId)
    .select('id,title,description,topic_name,upvote_count,created_at')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapPublicSuggestion(data as never);
}

export function createRawVerificationToken() {
  return randomBytes(32).toString('hex');
}

export function hashVerificationToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export async function createFreakyVerificationToken(input: {
  purpose: FreakyVerificationPurpose;
  identityId: string;
  suggestionId?: string | null;
  ip: string;
  userAgent: string;
  expiresInHours?: number;
}) {
  const supabase = createSupabaseAdminClient();
  const rawToken = createRawVerificationToken();
  const tokenHash = hashVerificationToken(rawToken);
  const expiresInHours = Number.isFinite(input.expiresInHours) ? Number(input.expiresInHours) : 24;
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('freaky_verification_tokens')
    .insert({
      purpose: input.purpose,
      token_hash: tokenHash,
      identity_id: input.identityId,
      suggestion_id: input.suggestionId || null,
      request_ip: input.ip,
      user_agent: input.userAgent || '',
      expires_at: expiresAt
    })
    .select('id,purpose,identity_id,suggestion_id,expires_at,consumed_at,created_at')
    .single();

  if (error || !data) throw error || new Error('Failed to create verification token.');

  return {
    rawToken,
    token: data as FreakyVerificationTokenRow
  };
}

export async function getFreakyVerificationTokenByRaw(rawToken: string) {
  const supabase = createSupabaseAdminClient();
  const tokenHash = hashVerificationToken(rawToken);

  const { data, error } = await supabase
    .from('freaky_verification_tokens')
    .select('id,purpose,identity_id,suggestion_id,expires_at,consumed_at,created_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as FreakyVerificationTokenRow | null;
}

export async function getFreakyVerificationTokenById(requestId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('freaky_verification_tokens')
    .select('id,purpose,identity_id,suggestion_id,expires_at,consumed_at,created_at')
    .eq('id', requestId)
    .maybeSingle();

  if (error) throw error;
  return (data || null) as FreakyVerificationTokenRow | null;
}

export async function consumeFreakyVerificationToken(tokenId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('freaky_verification_tokens')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', tokenId)
    .is('consumed_at', null);

  if (error) throw error;
}

export async function hasRecentVerificationToken(input: {
  identityId: string;
  purpose: FreakyVerificationPurpose;
  withinSeconds: number;
}) {
  const supabase = createSupabaseAdminClient();
  const since = new Date(Date.now() - input.withinSeconds * 1000).toISOString();

  const { count, error } = await supabase
    .from('freaky_verification_tokens')
    .select('id', { count: 'exact', head: true })
    .eq('identity_id', input.identityId)
    .eq('purpose', input.purpose)
    .gte('created_at', since);

  if (error) throw error;
  return (count || 0) > 0;
}

export async function castFreakyVote(input: { suggestionId: string; identityId: string }) {
  const supabase = createSupabaseAdminClient();
  const voteInsert = await supabase
    .from('freaky_votes')
    .insert({
      suggestion_id: input.suggestionId,
      identity_id: input.identityId
    })
    .select('id')
    .maybeSingle();

  if (voteInsert.error) {
    const code = (voteInsert.error as { code?: string }).code;
    if (code === '23505') {
      const latest = await getFreakySuggestionById(input.suggestionId);
      return {
        alreadyBacked: true,
        upvoteCount: latest?.upvoteCount || 0
      };
    }
    throw voteInsert.error;
  }

  // Increment from the currently stored count so retrospective admin-set totals remain the baseline.
  const current = await getFreakySuggestionById(input.suggestionId);
  const nextCount = Math.max(0, (current?.upvoteCount || 0) + 1);
  const bump = await supabase
    .from('freaky_suggestions')
    .update({ upvote_count: nextCount })
    .eq('id', input.suggestionId);
  if (bump.error) throw bump.error;

  const latest = await getFreakySuggestionById(input.suggestionId);
  return {
    alreadyBacked: false,
    upvoteCount: latest?.upvoteCount || 0
  };
}

export async function getFreakySuggestionById(suggestionId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('freaky_suggestions')
    .select('id,title,description,topic_name,upvote_count,created_at,status,is_visible,submitted_by_identity_id,covered_episode_id,covered_at')
    .eq('id', suggestionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    topicName: data.topic_name || '',
    upvoteCount: data.upvote_count,
    createdAt: data.created_at,
    status: data.status as FreakySuggestionStatus,
    isVisible: data.is_visible,
    submittedByIdentityId: data.submitted_by_identity_id as string | null,
    isCovered: Boolean(data.covered_episode_id),
    coveredEpisodeId: data.covered_episode_id as string | null,
    coveredAt: data.covered_at as string | null
  };
}

export async function getFreakySuggestionNotificationDetails(suggestionId: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('freaky_suggestions')
    .select('id,title,description,topic_name,submitted_full_name,submitted_country')
    .eq('id', suggestionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id as string,
    title: data.title as string,
    description: data.description as string,
    topicName: (data.topic_name as string) || '',
    fullName: (data.submitted_full_name as string) || '',
    country: (data.submitted_country as string) || ''
  };
}

export function isVerificationExpired(expiresAt: string): boolean {
  const expiry = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiry)) return true;
  return Date.now() > expiry;
}
