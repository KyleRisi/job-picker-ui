import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const policyPath = path.join(cwd, 'lib', 'taxonomy-route-policy.json');
const prechangeInventoryPath = path.join(cwd, 'tmp', 'taxonomy-audit', 'prechange', 'inventory_routes.csv');
const outputDir = path.join(cwd, 'tmp', 'taxonomy-audit');
const reportJsonPath = path.join(outputDir, 'migration-report.json');
const reportCsvPath = path.join(outputDir, 'migration-report.csv');

function normalizePath(input) {
  const raw = `${input || ''}`.trim();
  if (!raw) return '/';
  let value = raw;
  if (!value.startsWith('/')) value = `/${value}`;
  const [pathOnly] = value.split('?');
  const compact = pathOnly.replace(/\/+/g, '/');
  if (compact === '/') return '/';
  return compact.replace(/\/+$/, '').toLowerCase() || '/';
}

function loadPolicy() {
  return JSON.parse(fs.readFileSync(policyPath, 'utf8'));
}

function parseCsvRows(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0]
    .split(',')
    .map((column) => column.trim().replace(/^"|"$/g, ''));
  const rows = [];
  for (const line of lines.slice(1)) {
    const cells = line
      .split(',')
      .map((cell) => cell.trim().replace(/^"|"$/g, ''));
    const row = {};
    header.forEach((key, index) => {
      row[key] = cells[index] || '';
    });
    rows.push(row);
  }
  return rows;
}

function validatePolicy(entries) {
  const normalizedEntries = entries.map((entry) => ({
    ...entry,
    route: normalizePath(entry.route),
    redirect_destination: entry.redirect_destination ? normalizePath(entry.redirect_destination) : null
  }));

  const byRoute = new Map();
  for (const entry of normalizedEntries) {
    if (byRoute.has(entry.route)) {
      throw new Error(`Duplicate route policy entry for "${entry.route}".`);
    }
    if (!entry.previous_behavior || !entry.new_behavior || !entry.rationale) {
      throw new Error(`Route policy entry "${entry.route}" is missing required audit fields.`);
    }
    if (entry.action === 'redirect_301') {
      if (entry.status_code !== 301) throw new Error(`redirect_301 route "${entry.route}" must use status_code 301.`);
      if (!entry.redirect_destination) throw new Error(`redirect_301 route "${entry.route}" must include redirect_destination.`);
    } else if (entry.action === 'gone_410') {
      if (entry.status_code !== 410) throw new Error(`gone_410 route "${entry.route}" must use status_code 410.`);
      if (entry.redirect_destination) throw new Error(`gone_410 route "${entry.route}" cannot include redirect_destination.`);
    } else {
      if (entry.status_code !== 200) throw new Error(`Live route "${entry.route}" must use status_code 200.`);
    }
    byRoute.set(entry.route, entry);
  }

  const redirectEntries = normalizedEntries.filter((entry) => entry.action === 'redirect_301');
  const redirectByRoute = new Map(redirectEntries.map((entry) => [entry.route, entry]));
  for (const entry of redirectEntries) {
    const seen = new Set([entry.route]);
    let current = entry.redirect_destination;
    while (current && redirectByRoute.has(current)) {
      if (seen.has(current)) {
        throw new Error(`Redirect loop detected for "${entry.route}".`);
      }
      seen.add(current);
      const next = redirectByRoute.get(current);
      current = next?.redirect_destination || null;
    }
    if (current && current !== entry.redirect_destination) {
      throw new Error(
        `Redirect chain detected for "${entry.route}" -> "${entry.redirect_destination}" -> "${current}". ` +
        'Map directly to terminal destination.'
      );
    }
  }

  return normalizedEntries;
}

function loadDiscoveryInventoryRoutes() {
  if (!fs.existsSync(prechangeInventoryPath)) {
    return { skipped: true, routes: [], reason: `Inventory file not found at ${prechangeInventoryPath}` };
  }
  const csv = fs.readFileSync(prechangeInventoryPath, 'utf8');
  const rows = parseCsvRows(csv);
  const discoverySources = new Set([
    'active_discovery_term',
    'legacy_blog_category',
    'legacy_blog_topic_cluster',
    'legacy_blog_series'
  ]);
  const routes = [...new Set(
    rows
      .filter((row) => discoverySources.has(`${row.source || ''}`))
      .map((row) => normalizePath(`${row.route || ''}`))
      .filter(Boolean)
  )];
  return { skipped: false, routes, reason: '' };
}

function toCsv(rows) {
  const header = [
    'route',
    'previous_behavior',
    'new_behavior',
    'status_code',
    'redirect_destination',
    'rationale'
  ];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push([
      row.route,
      row.previous_behavior,
      row.new_behavior,
      `${row.status_code}`,
      row.redirect_destination || '',
      row.rationale
    ].map((value) => `"${`${value || ''}`.replace(/"/g, '""')}"`).join(','));
  }
  return `${lines.join('\n')}\n`;
}

async function supabaseRequest({ method, path: routePath, token, url, body }) {
  const response = await fetch(`${url}/rest/v1/${routePath}`, {
    method,
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=merge-duplicates'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed [${method} ${routePath}] (${response.status}): ${text}`);
  }
  const text = await response.text();
  return text ? JSON.parse(text) : [];
}

async function persistToSupabase(entries) {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}`.trim().replace(/\/+$/, '');
  const token = `${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`.trim();
  if (!url || !token) {
    return {
      skipped: true,
      reason: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.',
      auditUpserts: 0,
      redirectUpserts: 0,
      redirectDisabled: 0
    };
  }

  const auditRows = entries.map((entry) => ({
    route: entry.route,
    previous_behavior: entry.previous_behavior,
    new_behavior: entry.new_behavior,
    status_code: entry.status_code,
    redirect_destination: entry.redirect_destination,
    rationale: entry.rationale,
    source_type: 'taxonomy_route_policy'
  }));

  let auditUpserts = 0;
  let auditReason = '';
  try {
    const upsertedAuditRows = await supabaseRequest({
      method: 'POST',
      path: 'taxonomy_route_migration_audit?on_conflict=route',
      url,
      token,
      body: auditRows
    });
    auditUpserts = Array.isArray(upsertedAuditRows) ? upsertedAuditRows.length : auditRows.length;
  } catch (error) {
    const message = `${error instanceof Error ? error.message : error || ''}`;
    if (
      message.includes('taxonomy_route_migration_audit')
      && (message.includes('does not exist') || message.includes('relation') || message.includes('Could not find the table'))
    ) {
      auditReason = 'taxonomy_route_migration_audit table is unavailable. Run migration 0027_taxonomy_route_migration_audit.sql.';
    } else {
      throw error;
    }
  }

  const redirectRows = entries
    .filter((entry) => entry.action === 'redirect_301' || entry.action === 'gone_410')
    .map((entry) => ({
      source_path: entry.route,
      target_url: entry.action === 'redirect_301' ? entry.redirect_destination : null,
      status_code: entry.action === 'redirect_301' ? 301 : 410,
      match_type: 'exact',
      is_active: true,
      priority: 300,
      notes: `Taxonomy route policy (${entry.action})`,
      source_type: 'taxonomy_route_policy',
      source_ref: entry.route
    }));

  if (redirectRows.length) {
    await supabaseRequest({
      method: 'POST',
      path: 'redirects?on_conflict=source_path,match_type',
      url,
      token,
      body: redirectRows
    });
  }

  const existingPolicyRedirects = await supabaseRequest({
    method: 'GET',
    path: 'redirects?select=id,source_path,is_active&source_type=eq.taxonomy_route_policy',
    url,
    token
  });
  const activePolicyRoutes = new Set(redirectRows.map((row) => normalizePath(row.source_path)));
  const staleRedirectIds = (existingPolicyRedirects || [])
    .filter((row) => row?.is_active === true && !activePolicyRoutes.has(normalizePath(row.source_path)))
    .map((row) => row.id)
    .filter(Boolean);

  let redirectDisabled = 0;
  if (staleRedirectIds.length) {
    for (let index = 0; index < staleRedirectIds.length; index += 100) {
      const chunk = staleRedirectIds.slice(index, index + 100);
      const inClause = `(${chunk.join(',')})`;
      const updated = await supabaseRequest({
        method: 'PATCH',
        path: `redirects?id=in.${inClause}`,
        url,
        token,
        body: { is_active: false, notes: 'Disabled by taxonomy route policy sync.' }
      });
      redirectDisabled += Array.isArray(updated) ? updated.length : chunk.length;
    }
  }

  return {
    skipped: false,
    reason: auditReason,
    auditUpserts,
    redirectUpserts: redirectRows.length,
    redirectDisabled
  };
}

async function main() {
  const policy = loadPolicy();
  const entries = validatePolicy(policy.routes || []);
  const byRoute = new Map(entries.map((entry) => [entry.route, entry]));

  const inventory = loadDiscoveryInventoryRoutes();
  const unclassifiedInventoryRoutes = inventory.routes.filter((route) => !byRoute.has(route));
  if (unclassifiedInventoryRoutes.length) {
    throw new Error(
      `Inventory routes missing classification: ${unclassifiedInventoryRoutes.join(', ')}`
    );
  }

  const sortedEntries = [...entries].sort((a, b) => a.route.localeCompare(b.route));
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(reportJsonPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    inventory_checked: !inventory.skipped,
    inventory_check_reason: inventory.reason,
    inventory_discovery_route_count: inventory.routes.length,
    unclassified_inventory_routes: unclassifiedInventoryRoutes,
    route_count: sortedEntries.length,
    routes: sortedEntries.map((entry) => ({
      route: entry.route,
      previous_behavior: entry.previous_behavior,
      new_behavior: entry.new_behavior,
      status_code: entry.status_code,
      redirect_destination: entry.redirect_destination,
      rationale: entry.rationale
    }))
  }, null, 2));
  fs.writeFileSync(reportCsvPath, toCsv(sortedEntries));

  const persistence = await persistToSupabase(sortedEntries);
  const summary = {
    generated_at: new Date().toISOString(),
    route_count: sortedEntries.length,
    inventory_checked: !inventory.skipped,
    inventory_check_reason: inventory.reason,
    inventory_discovery_route_count: inventory.routes.length,
    unclassified_inventory_routes: unclassifiedInventoryRoutes,
    persisted_to_supabase: !persistence.skipped,
    supabase_reason: persistence.reason,
    supabase_audit_upserts: persistence.auditUpserts,
    supabase_redirect_upserts: persistence.redirectUpserts,
    supabase_redirect_disabled: persistence.redirectDisabled,
    report_json: reportJsonPath,
    report_csv: reportCsvPath
  };
  fs.writeFileSync(path.join(outputDir, 'migration-sync-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
