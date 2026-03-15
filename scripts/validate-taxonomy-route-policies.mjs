import fs from 'node:fs';
import path from 'node:path';

const cwd = process.cwd();
const policyPath = path.join(cwd, 'lib', 'taxonomy-route-policy.json');
const outputDir = path.join(cwd, 'tmp', 'taxonomy-audit');
const outputPath = path.join(outputDir, 'policy-validation.json');

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

function validateInternalChains(routes) {
  const redirectRoutes = routes
    .filter((entry) => entry.action === 'redirect_301')
    .map((entry) => ({
      ...entry,
      route: normalizePath(entry.route),
      redirect_destination: normalizePath(entry.redirect_destination)
    }));
  const byRoute = new Map(redirectRoutes.map((entry) => [entry.route, entry]));
  const issues = [];

  for (const entry of redirectRoutes) {
    const seen = new Set([entry.route]);
    let current = entry.redirect_destination;
    let hops = 0;
    while (byRoute.has(current)) {
      const next = byRoute.get(current);
      if (!next) break;
      if (seen.has(current)) {
        issues.push({
          type: 'internal_loop',
          route: entry.route,
          destination: entry.redirect_destination
        });
        break;
      }
      seen.add(current);
      hops += 1;
      current = normalizePath(next.redirect_destination);
    }
    if (hops > 0) {
      issues.push({
        type: 'internal_chain',
        route: entry.route,
        destination: entry.redirect_destination,
        terminal_destination: current
      });
    }
  }

  return { redirectRoutes, issues };
}

async function fetchExistingRedirects() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const token = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !token) {
    return { data: [], skipped: true, reason: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.' };
  }

  const endpoint = `${url}/rest/v1/redirects?select=source_path,target_url,status_code,match_type,is_active,priority&is_active=eq.true&match_type=eq.exact`;
  const response = await fetch(endpoint, {
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) {
    return {
      data: [],
      skipped: true,
      reason: `Failed to load redirects table (${response.status}).`
    };
  }

  const data = await response.json();
  return { data, skipped: false, reason: '' };
}

function validateDatabaseChains(redirectRoutes, dbRows) {
  const dbBySource = new Map(
    (dbRows || [])
      .filter((row) => row && row.is_active === true && row.match_type === 'exact')
      .map((row) => [normalizePath(row.source_path), row])
  );

  const issues = [];
  for (const entry of redirectRoutes) {
    let current = normalizePath(entry.redirect_destination);
    const seen = new Set([entry.route]);
    let hops = 0;

    while (dbBySource.has(current)) {
      const row = dbBySource.get(current);
      if (!row) break;
      if (seen.has(current)) {
        issues.push({
          type: 'db_loop',
          route: entry.route,
          destination: entry.redirect_destination
        });
        break;
      }
      seen.add(current);
      hops += 1;
      if (Number(row.status_code) === 410) {
        issues.push({
          type: 'db_points_to_410',
          route: entry.route,
          destination: entry.redirect_destination,
          terminal_destination: current
        });
        break;
      }
      const next = `${row.target_url || ''}`.trim();
      if (!next.startsWith('/')) break;
      current = normalizePath(next);
    }

    if (hops > 0) {
      issues.push({
        type: 'db_chain',
        route: entry.route,
        destination: entry.redirect_destination,
        terminal_destination: current
      });
    }
  }

  return issues;
}

async function main() {
  const policy = loadPolicy();
  const { redirectRoutes, issues: internalIssues } = validateInternalChains(policy.routes || []);
  const db = await fetchExistingRedirects();
  const dbIssues = db.skipped ? [] : validateDatabaseChains(redirectRoutes, db.data);
  const issues = [...internalIssues, ...dbIssues];

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    outputPath,
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        checked_redirect_routes: redirectRoutes.length,
        db_check_skipped: db.skipped,
        db_check_reason: db.reason,
        issue_count: issues.length,
        issues
      },
      null,
      2
    )
  );

  if (issues.length) {
    console.error(`Policy validation failed with ${issues.length} issue(s). See ${outputPath}`);
    process.exit(1);
  }

  console.log(`Policy validation passed. Report written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

