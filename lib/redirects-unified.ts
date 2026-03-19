import { getPublicSiteUrl } from '@/lib/site-url';
import { getAllTaxonomyRoutePolicies } from '@/lib/taxonomy-route-policy';

const OBSERVABILITY_CANONICAL_URL = 'https://www.thecompendiumpodcast.com';
const LOCALHOST_HOST_RE = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i;

export type RedirectRuleType = 'Manual' | 'Blog slug' | 'Taxonomy policy' | 'System pattern' | 'Canonical host/protocol';
export type RedirectOwnerLayer = 'redirects_table' | 'taxonomy_policy' | 'middleware_deterministic' | 'edge_canonical';
export type RedirectBackingType = 'table_backed' | 'system_generated';

export type UnifiedRedirectRow = {
  id: string;
  source: string;
  target: string | null;
  status_code: 301 | 302 | 307 | 308 | 410;
  owner_layer: RedirectOwnerLayer;
  source_type: string;
  editable: boolean;
  rule_type: RedirectRuleType;
  notes_reason: string;
  active: boolean;
  created_at: string | null;
  updated_at: string | null;
  backing_type: RedirectBackingType;
  backing_ref: string;
  read_only_reason: string | null;
  match_type: 'exact' | 'prefix';
  priority: number | null;
};

export type RedirectTableRow = {
  id: string;
  source_path: string;
  target_url: string | null;
  status_code: 301 | 302 | 307 | 308 | 410;
  match_type: 'exact' | 'prefix';
  is_active: boolean;
  priority: number;
  notes: string;
  source_type?: string;
  source_ref?: string | null;
  created_at: string;
  updated_at: string;
};

function inferRuleTypeFromSourceType(sourceType: string): RedirectRuleType {
  if (sourceType === 'taxonomy_route_policy' || sourceType.startsWith('taxonomy')) return 'Taxonomy policy';
  if (sourceType === 'blog_slug') return 'Blog slug';
  return 'Manual';
}

function mapTableRow(row: RedirectTableRow): UnifiedRedirectRow {
  const normalizedSourceType = `${row.source_type || 'manual'}`;
  const ruleType = inferRuleTypeFromSourceType(normalizedSourceType);
  const editable = ruleType !== 'Taxonomy policy' && row.status_code !== 410;
  const readOnlyReason = editable
    ? null
    : ruleType === 'Taxonomy policy'
      ? 'Owned by taxonomy policy; edit at the policy source of truth.'
      : '410 rows are currently managed as read-only in the unified workspace view.';

  return {
    id: row.id,
    source: row.source_path,
    target: row.target_url,
    status_code: row.status_code,
    owner_layer: 'redirects_table',
    source_type: normalizedSourceType,
    editable,
    rule_type: ruleType,
    notes_reason: row.notes || (ruleType === 'Taxonomy policy' ? 'Mirrored taxonomy policy row.' : 'Table-backed redirect row.'),
    active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    backing_type: 'table_backed',
    backing_ref: `redirects:${row.id}`,
    read_only_reason: readOnlyReason,
    match_type: row.match_type,
    priority: row.priority
  };
}

function buildTaxonomyPolicySystemRows(): UnifiedRedirectRow[] {
  const policies = getAllTaxonomyRoutePolicies();
  return policies
    .filter((entry) => entry.action === 'redirect_301' || entry.action === 'gone_410')
    .map((entry) => ({
      id: `taxonomy-policy:${entry.route}`,
      source: entry.route,
      target: entry.action === 'redirect_301' ? entry.redirect_destination : null,
      status_code: entry.action === 'redirect_301' ? 301 : 410,
      owner_layer: 'taxonomy_policy' as const,
      source_type: 'taxonomy_route_policy',
      editable: false,
      rule_type: 'Taxonomy policy' as const,
      notes_reason: entry.rationale || 'Taxonomy policy generated rule.',
      active: true,
      created_at: null,
      updated_at: null,
      backing_type: 'system_generated' as const,
      backing_ref: `taxonomy-policy:${entry.route}`,
      read_only_reason: 'System-generated from taxonomy policy.',
      match_type: 'exact' as const,
      priority: null
    }));
}

function buildDeterministicPatternSystemRows(): UnifiedRedirectRow[] {
  const rules: Array<{ source: string; target: string; notes: string }> = [
    {
      source: '/episode/:slug*',
      target: '/episodes/:slug*',
      notes: 'Deterministic legacy episode redirect pattern.'
    },
    {
      source: '/episodes/episode-<number>-<slug>',
      target: '/episodes/<slug>',
      notes: 'Deterministic numbered episode canonicalization pattern.'
    },
    {
      source: '/podcast/the-compendium-of-fascinating-things/episode/:slug*',
      target: '/episodes/:slug*',
      notes: 'Deterministic podcast legacy episode canonicalization pattern.'
    }
  ];

  return rules.map((rule) => ({
    id: `system-pattern:${rule.source}`,
    source: rule.source,
    target: rule.target,
    status_code: 301,
    owner_layer: 'middleware_deterministic',
    source_type: 'system_pattern',
    editable: false,
    rule_type: 'System pattern',
    notes_reason: rule.notes,
    active: true,
    created_at: null,
    updated_at: null,
    backing_type: 'system_generated',
    backing_ref: `system-pattern:${rule.source}`,
    read_only_reason: 'Deterministic runtime rule. Not table-backed.',
    match_type: 'prefix',
    priority: null
  }));
}

function buildCanonicalHostProtocolSystemRows(): UnifiedRedirectRow[] {
  const candidateUrl = new URL(getPublicSiteUrl());
  const publicSiteUrl = LOCALHOST_HOST_RE.test(candidateUrl.host)
    ? new URL(OBSERVABILITY_CANONICAL_URL)
    : candidateUrl;
  const canonicalHost = publicSiteUrl.host;
  const canonicalOrigin = `${publicSiteUrl.protocol}//${canonicalHost}`;
  const apexHost = canonicalHost.startsWith('www.') ? canonicalHost.slice(4) : canonicalHost;

  const rules: Array<{ source: string; target: string }> = [
    { source: `http://${apexHost}/`, target: `https://${apexHost}/` },
    { source: `http://${canonicalHost}/`, target: `${canonicalOrigin}/` }
  ];

  if (apexHost !== canonicalHost) {
    rules.push({ source: `https://${apexHost}/`, target: `${canonicalOrigin}/` });
  }

  const unique = new Map<string, { source: string; target: string }>();
  for (const rule of rules) {
    const key = `${rule.source}->${rule.target}`;
    if (!unique.has(key)) unique.set(key, rule);
  }

  return [...unique.values()].map((rule) => ({
    id: `canonical:${rule.source}`,
    source: rule.source,
    target: rule.target,
    status_code: 301,
    owner_layer: 'edge_canonical',
    source_type: 'canonical_host_protocol',
    editable: false,
    rule_type: 'Canonical host/protocol',
    notes_reason: 'Canonical host/protocol enforcement rule.',
    active: true,
    created_at: null,
    updated_at: null,
    backing_type: 'system_generated',
    backing_ref: `canonical:${rule.source}`,
    read_only_reason: 'Edge/domain canonicalization rule. Not table-backed.',
    match_type: 'exact',
    priority: null
  }));
}

export function buildUnifiedRedirectRows(tableRows: RedirectTableRow[]): UnifiedRedirectRow[] {
  const mappedTableRows = tableRows.map(mapTableRow);
  const taxonomyPolicyRows = buildTaxonomyPolicySystemRows();
  const patternRows = buildDeterministicPatternSystemRows();
  const canonicalRows = buildCanonicalHostProtocolSystemRows();

  return [
    ...mappedTableRows,
    ...taxonomyPolicyRows,
    ...patternRows,
    ...canonicalRows
  ];
}
