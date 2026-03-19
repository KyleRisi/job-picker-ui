import fs from 'node:fs';
import path from 'node:path';

const WORKDIR = process.cwd();
const AUDIT_DIR = path.join(WORKDIR, 'tmp', 'taxonomy-audit');
const OUT_DIR = path.join(AUDIT_DIR, 'post-cleanup');
const PRE_SNAPSHOT_PATH = path.join(AUDIT_DIR, 'live-active-redirects.json');
const LEGACY_PODCAST_EPISODE_PREFIX = '/podcast/the-compendium-of-fascinating-things/episode/';

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

function normalizePathLike(value) {
  if (!value) return '';
  try {
    const u = new URL(value);
    return `${u.pathname}${u.search}`.replace(/\/$/, '') || '/';
  } catch {
    return `${value}`.replace(/\/$/, '') || '/';
  }
}

function normalizeAbsolute(value) {
  if (!value) return '';
  try {
    const u = new URL(value);
    return `${u.protocol}//${u.host}${u.pathname}${u.search}`.replace(/\/$/, '');
  } catch {
    return value.replace(/\/$/, '');
  }
}

function isLegacyPodcastEpisodeSource(sourcePath) {
  return sourcePath.startsWith(LEGACY_PODCAST_EPISODE_PREFIX);
}

function isPodcastEpisodeAliasSource(sourcePath) {
  return /^\/podcast\/[^/]+\/episode\//i.test(sourcePath);
}

function isCurrentEpisodeMirrorPath(pathLike) {
  return /^\/episodes\/[^/?#]+$/i.test(pathLike);
}

async function fetchCurrentActiveRows() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  const url = `${supabaseUrl}/rest/v1/redirects?select=id,source_path,target_url,status_code,match_type,is_active,priority,source_type,source_ref,created_at,updated_at&is_active=eq.true&order=source_path.asc`;
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

async function traceChain(startUrl, maxHops = 12) {
  let current = startUrl;
  let hopCount = 0;
  const steps = [];

  while (true) {
    let res;
    try {
      res = await fetch(current, { method: 'GET', redirect: 'manual' });
    } catch (error) {
      steps.push({ status: 'FETCH_ERROR', url: current, error: error instanceof Error ? error.message : String(error) });
      return {
        full_chain: steps.map((s) => `${s.status} ${s.url}`).join(' | '),
        final_url: current,
        final_status: 0,
        hop_count: hopCount,
        fetch_error: true
      };
    }

    const status = res.status;
    steps.push({ status, url: current });

    const location = res.headers.get('location');
    if (!location || status < 300 || status >= 400) {
      return {
        full_chain: steps.map((s) => `${s.status} ${s.url}`).join(' | '),
        final_url: current,
        final_status: status,
        hop_count: hopCount,
        fetch_error: false
      };
    }

    const next = new URL(location, current).toString();
    current = next;
    hopCount += 1;
    if (hopCount >= maxHops) {
      steps.push({ status: 'MAX_HOPS_REACHED', url: current });
      return {
        full_chain: steps.map((s) => `${s.status} ${s.url}`).join(' | '),
        final_url: current,
        final_status: 0,
        hop_count: hopCount,
        fetch_error: false
      };
    }
  }
}

function classifyResult(sourcePath, chainResult, expectedTargets) {
  const finalPath = normalizePathLike(chainResult.final_url);
  const finalAbs = normalizeAbsolute(chainResult.final_url);

  // Policy alignment: podcast episode aliases are evaluated under current support policy.
  // Unsupported historical aliases are informational, not active cleanup failures.
  if (isPodcastEpisodeAliasSource(sourcePath)) {
    if (chainResult.final_status === 200 && isCurrentEpisodeMirrorPath(finalPath)) return 'correct';
    return 'policy_unsupported_legacy_alias';
  }

  if (chainResult.final_status === 0 || chainResult.final_status >= 400) return 'broken';

  if (!expectedTargets.length) return chainResult.final_status === 200 ? 'correct' : 'suspicious';

  for (const expected of expectedTargets) {
    if (!expected) continue;
    if (/^https?:\/\//i.test(expected)) {
      if (normalizeAbsolute(expected) === finalAbs) return 'correct';
    } else {
      if (normalizePathLike(expected) === finalPath) return 'correct';
    }
  }

  return 'suspicious';
}

function parseCsvLines(filePath) {
  const content = fs.readFileSync(filePath, 'utf8').trim();
  if (!content) return [];
  const lines = content.split(/\r?\n/);
  const header = lines.shift().split(',');
  return lines.map((line) => {
    const values = line.split(',');
    const row = {};
    for (let i = 0; i < header.length; i += 1) row[header[i]] = values[i] || '';
    return row;
  });
}

async function main() {
  ensureDir(OUT_DIR);
  loadEnv();

  const ts = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, 'Z');

  const preRows = JSON.parse(fs.readFileSync(PRE_SNAPSHOT_PATH, 'utf8'));
  const currentRows = await fetchCurrentActiveRows();

  const snapshotJson = path.join(OUT_DIR, `live-active-redirects-${ts}.json`);
  const snapshotCsv = path.join(OUT_DIR, `live-active-redirects-${ts}.csv`);
  fs.writeFileSync(snapshotJson, JSON.stringify(currentRows, null, 2));
  fs.writeFileSync(snapshotCsv, toCsv(currentRows, [
    'id', 'source_path', 'target_url', 'status_code', 'match_type', 'is_active', 'priority', 'source_type', 'source_ref', 'created_at', 'updated_at'
  ]));

  const byCurrentSource = new Set(currentRows.map((r) => r.source_path));
  const deletedRows = preRows.filter((r) => !byCurrentSource.has(r.source_path));

  const expectedBySource = new Map();
  for (const row of deletedRows) {
    if (!expectedBySource.has(row.source_path)) expectedBySource.set(row.source_path, new Set());
    expectedBySource.get(row.source_path).add(row.target_url || '');
  }

  const deletedSourcePaths = [...new Set(deletedRows.map((r) => r.source_path))].sort();
  const chainRows = [];

  for (const sourcePath of deletedSourcePaths) {
    const startUrl = /^https?:\/\//i.test(sourcePath)
      ? sourcePath
      : `https://www.thecompendiumpodcast.com${sourcePath.startsWith('/') ? '' : '/'}${sourcePath}`;
    const chain = await traceChain(startUrl);
    const expectedTargets = [...(expectedBySource.get(sourcePath) || [])].filter(Boolean);
    const resultClass = classifyResult(sourcePath, chain, expectedTargets);
    chainRows.push({
      source_path: sourcePath,
      still_resolves: chain.final_status > 0 && chain.final_status < 400,
      full_chain: chain.full_chain,
      final_url: chain.final_url,
      final_status: chain.final_status,
      expected_targets: expectedTargets.join(' | '),
      result: resultClass
    });
  }

  const chainCsv = path.join(OUT_DIR, `deleted-source-chain-checks-${ts}.csv`);
  fs.writeFileSync(chainCsv, toCsv(chainRows, [
    'source_path', 'still_resolves', 'full_chain', 'final_url', 'final_status', 'expected_targets', 'result'
  ]));

  const deletedPodcast = chainRows.filter((r) => isPodcastEpisodeAliasSource(r.source_path));
  const unsupportedPodcastLegacyAliases = deletedPodcast.filter((r) => r.result === 'policy_unsupported_legacy_alias');
  const nonPodcastActionRequired = chainRows.filter((r) => !isPodcastEpisodeAliasSource(r.source_path) && (r.result === 'broken' || r.result === 'suspicious'));

  const exceptionCsvPath = path.join(AUDIT_DIR, 'podcast-manual-exceptions.csv');
  const exceptionRows = fs.existsSync(exceptionCsvPath) ? parseCsvLines(exceptionCsvPath) : [];
  const currentSourceSet = new Set(currentRows.map((r) => r.source_path));
  const remainingExceptions = exceptionRows.filter((r) => currentSourceSet.has(r.source_path));

  const canonicalUrls = [
    'http://thecompendiumpodcast.com/',
    'https://thecompendiumpodcast.com/',
    'http://www.thecompendiumpodcast.com/',
    'https://www.thecompendiumpodcast.com/'
  ];
  const canonicalChecks = [];
  for (const url of canonicalUrls) {
    const chain = await traceChain(url);
    canonicalChecks.push({
      requested_url: url,
      full_chain: chain.full_chain,
      final_url: chain.final_url,
      final_status: chain.final_status
    });
  }

  const legacyChecks = [];
  for (const p of ['/blog/jennifer-fairgate', '/blog/emanuela-orlandi']) {
    const chain = await traceChain(`https://www.thecompendiumpodcast.com${p}`);
    legacyChecks.push({
      source_path: p,
      full_chain: chain.full_chain,
      final_url: chain.final_url,
      final_status: chain.final_status
    });
  }

  const summary = {
    generated_at: new Date().toISOString(),
    snapshot: {
      current_json: path.relative(WORKDIR, snapshotJson),
      current_csv: path.relative(WORKDIR, snapshotCsv),
      pre_snapshot: path.relative(WORKDIR, PRE_SNAPSHOT_PATH),
      pre_count: preRows.length,
      current_count: currentRows.length
    },
    totals: {
      rows_deleted: deletedRows.length,
      deleted_source_paths: deletedSourcePaths.length,
      deleted_resolve_correct: chainRows.filter((r) => r.result === 'correct').length,
      deleted_broken: chainRows.filter((r) => r.result === 'broken').length,
      deleted_suspicious: chainRows.filter((r) => r.result === 'suspicious').length,
      deleted_policy_unsupported_legacy_aliases: chainRows.filter((r) => r.result === 'policy_unsupported_legacy_alias').length
    },
    high_risk: {
      deleted_podcast_rows: deletedPodcast.length,
      deleted_podcast_policy_unsupported_legacy_aliases: unsupportedPodcastLegacyAliases.length,
      deleted_podcast_broken_or_suspicious: deletedPodcast.filter((r) => r.result === 'broken' || r.result === 'suspicious').length,
      non_podcast_action_required_count: nonPodcastActionRequired.length,
      non_podcast_action_required_sample: nonPodcastActionRequired.slice(0, 25).map((r) => ({
        source_path: r.source_path,
        result: r.result,
        final_status: r.final_status,
        final_url: r.final_url
      })),
      remaining_podcast_exception_rows: remainingExceptions.length,
      canonical_checks: canonicalChecks,
      legacy_blog_checks: legacyChecks
    },
    outputs: {
      deleted_chain_checks_csv: path.relative(WORKDIR, chainCsv)
    }
  };

  const summaryPath = path.join(OUT_DIR, `post-cleanup-verification-summary-${ts}.json`);
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  console.log(JSON.stringify({
    summary_file: path.relative(WORKDIR, summaryPath),
    chain_checks_file: path.relative(WORKDIR, chainCsv),
    ...summary.totals,
    high_risk: {
      deleted_podcast_rows: summary.high_risk.deleted_podcast_rows,
      deleted_podcast_policy_unsupported_legacy_aliases: summary.high_risk.deleted_podcast_policy_unsupported_legacy_aliases,
      deleted_podcast_broken_or_suspicious: summary.high_risk.deleted_podcast_broken_or_suspicious,
      non_podcast_action_required_count: summary.high_risk.non_podcast_action_required_count,
      remaining_podcast_exception_rows: summary.high_risk.remaining_podcast_exception_rows
    }
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
