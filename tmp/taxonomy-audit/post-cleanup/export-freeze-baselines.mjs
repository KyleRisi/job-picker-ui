import fs from 'node:fs';
import path from 'node:path';

const WORKDIR = process.cwd();
const AUDIT_DIR = path.join(WORKDIR, 'tmp', 'taxonomy-audit');
const OUT_DIR = path.join(AUDIT_DIR, 'post-cleanup');
const TAXONOMY_POLICY_JSON = path.join(WORKDIR, 'lib', 'taxonomy-route-policy.json');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function parseDotEnv(content) {
  const result = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    result[key] = value;
  }
  return result;
}

function loadEnv() {
  const envPath = path.join(WORKDIR, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const parsed = parseDotEnv(fs.readFileSync(envPath, 'utf8'));
  for (const [k, v] of Object.entries(parsed)) {
    if (!process.env[k]) process.env[k] = v;
  }
}

function toCsv(rows, headers) {
  const esc = (value) => {
    const s = `${value ?? ''}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => esc(row[h])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

async function fetchCurrentActiveRows() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const url = `${supabaseUrl}/rest/v1/redirects?select=id,source_path,target_url,status_code,match_type,is_active,priority,notes,source_type,source_ref,created_at,updated_at&is_active=eq.true&order=source_path.asc`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase fetch failed (${res.status}): ${text}`);
  }
  return await res.json();
}

function inferRuleTypeFromSourceType(sourceType) {
  if (sourceType === 'taxonomy_route_policy' || sourceType.startsWith('taxonomy')) return 'Taxonomy policy';
  if (sourceType === 'blog_slug') return 'Blog slug';
  return 'Manual';
}

function mapTableRow(row) {
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

function buildTaxonomyPolicySystemRows() {
  if (!fs.existsSync(TAXONOMY_POLICY_JSON)) return [];
  const policy = JSON.parse(fs.readFileSync(TAXONOMY_POLICY_JSON, 'utf8'));
  const routes = Array.isArray(policy.routes) ? policy.routes : [];
  return routes
    .filter((entry) => entry.action === 'redirect_301' || entry.action === 'gone_410')
    .map((entry) => ({
      id: `taxonomy-policy:${entry.route}`,
      source: entry.route,
      target: entry.action === 'redirect_301' ? entry.redirect_destination : null,
      status_code: entry.action === 'redirect_301' ? 301 : 410,
      owner_layer: 'taxonomy_policy',
      source_type: 'taxonomy_route_policy',
      editable: false,
      rule_type: 'Taxonomy policy',
      notes_reason: entry.rationale || 'Taxonomy policy generated rule.',
      active: true,
      created_at: null,
      updated_at: null,
      backing_type: 'system_generated',
      backing_ref: `taxonomy-policy:${entry.route}`,
      read_only_reason: 'System-generated from taxonomy policy.',
      match_type: 'exact',
      priority: null
    }));
}

function buildDeterministicPatternSystemRows() {
  const rules = [
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

function buildCanonicalHostProtocolSystemRows() {
  const canonicalHost = 'www.thecompendiumpodcast.com';
  const canonicalOrigin = `https://${canonicalHost}`;
  const apexHost = 'thecompendiumpodcast.com';

  const rules = [
    { source: `http://${apexHost}/`, target: `https://${apexHost}/` },
    { source: `http://${canonicalHost}/`, target: `${canonicalOrigin}/` },
    { source: `https://${apexHost}/`, target: `${canonicalOrigin}/` }
  ];

  return rules.map((rule) => ({
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

function sortUnifiedRows(rows) {
  return [...rows].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;

    const aUpdated = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    if (aUpdated !== bUpdated) return bUpdated - aUpdated;

    const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (aCreated !== bCreated) return bCreated - aCreated;

    return a.source.localeCompare(b.source);
  });
}

async function main() {
  ensureDir(OUT_DIR);
  loadEnv();

  const ts = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, 'Z');
  const tableRows = await fetchCurrentActiveRows();

  const tableJsonPath = path.join(OUT_DIR, `live-active-redirects-baseline-${ts}.json`);
  const tableCsvPath = path.join(OUT_DIR, `live-active-redirects-baseline-${ts}.csv`);

  fs.writeFileSync(tableJsonPath, JSON.stringify(tableRows, null, 2));
  fs.writeFileSync(tableCsvPath, toCsv(tableRows, [
    'id', 'source_path', 'target_url', 'status_code', 'match_type', 'is_active', 'priority', 'notes', 'source_type', 'source_ref', 'created_at', 'updated_at'
  ]));

  const unifiedRows = sortUnifiedRows([
    ...tableRows.map(mapTableRow),
    ...buildTaxonomyPolicySystemRows(),
    ...buildDeterministicPatternSystemRows(),
    ...buildCanonicalHostProtocolSystemRows()
  ]);

  const unifiedHeaders = [
    'id',
    'source',
    'target',
    'status_code',
    'owner_layer',
    'source_type',
    'editable',
    'rule_type',
    'notes_reason',
    'active',
    'created_at',
    'updated_at',
    'backing_type',
    'backing_ref',
    'read_only_reason',
    'match_type',
    'priority'
  ];

  const unifiedJsonPath = path.join(OUT_DIR, `unified-redirects-baseline-${ts}.json`);
  const unifiedCsvPath = path.join(OUT_DIR, `unified-redirects-baseline-${ts}.csv`);
  fs.writeFileSync(unifiedJsonPath, JSON.stringify(unifiedRows, null, 2));
  fs.writeFileSync(unifiedCsvPath, toCsv(unifiedRows, unifiedHeaders));

  const manifest = {
    generated_at: new Date().toISOString(),
    table_count: tableRows.length,
    unified_count: unifiedRows.length,
    files: {
      table_json: path.relative(WORKDIR, tableJsonPath),
      table_csv: path.relative(WORKDIR, tableCsvPath),
      unified_json: path.relative(WORKDIR, unifiedJsonPath),
      unified_csv: path.relative(WORKDIR, unifiedCsvPath)
    }
  };

  const manifestPath = path.join(OUT_DIR, `freeze-baseline-manifest-${ts}.json`);
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify({
    manifest_file: path.relative(WORKDIR, manifestPath),
    ...manifest
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
