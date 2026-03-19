import fs from 'node:fs';
import path from 'node:path';

const WORKDIR = process.cwd();

const REQUESTED_URLS = [
  'https://jobpicker.thecompendiumpodcast.com/',
  'https://thecompendiumpodcast.com/season/03',
  'https://thecompendiumpodcast.com/season/2',
  'https://thecompendiumpodcast.com/episode/marie-antoinette-her-life-and-legacy-misunderstood-and-misrepresented',
  'https://thecompendiumpodcast.com/podcast/the-compendium-of-fascinating-things/episode/bonus-its-raining-meat',
  'https://thecompendiumpodcast.com/episode/the-isabella-gardner-museum-heist-inside-the-largest-art-theft-in-history',
  'https://thecompendiumpodcast.com/episode/the-miracle-of-the-andes-the-story-of-a-group-of-survivors-of-a-plane-crash-in-the-andes-in-1972',
  'https://thecompendiumpodcast.com/episode/the-radium-girls-a-tragic-tale-of-courage-and-determination',
  'https://thecompendiumpodcast.com/episode/the-eternal-empire-behind-the-vatican-veil',
  'https://thecompendiumpodcast.com/episode/the-turpin-family-the-dark-tale-of-the-worst-child-abuse-case-in-modern-american-history',
  'https://thecompendiumpodcast.com/episode/the-mysterious-death-of-jonbenet-ramsey-a-closer-look-into-this-tragic-murder',
  'https://thecompendiumpodcast.com/episode/the-great-beanie-baby-bubble-the-rise-and-fall-of-the-popular-toy-craze-of-the-1990s',
  'https://thecompendiumpodcast.com/18/',
  'https://www.thecompendiumpodcast.com/18/',
  'https://thecompendiumpodcast.com/18',
  'https://thecompendiumpodcast.com/episode/gone-in-the-night-the-dupont-de-ligonnes-familys-disappearance',
  'https://thecompendiumpodcast.com/episode/the-roswell-incident-unraveling-the-truth-behind-americas-most-famous-ufo-crash',
  'https://thecompendiumpodcast.com/episode/the-great-train-robbery-britains-most-famous-heist-and-international-manhunt',
  'https://thecompendiumpodcast.com/episode/the-jennifer-pan-story-a-deadly-betrayal',
  'https://thecompendiumpodcast.com/episode/the-voynich-manuscript-investigating-the-cryptic-text-that-has-puzzled-experts-for-centuries',
  'https://www.thecompendiumpodcast.com/blog/the-american-dream-propaganda/'
];

const ALLOWED_HOSTS = new Set(['thecompendiumpodcast.com', 'www.thecompendiumpodcast.com']);

function parseDotEnv(content) {
  const out = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnv() {
  const envPath = path.join(WORKDIR, '.env.local');
  if (!fs.existsSync(envPath)) return;
  const parsed = parseDotEnv(fs.readFileSync(envPath, 'utf8'));
  for (const [k, v] of Object.entries(parsed)) {
    if (!process.env[k]) process.env[k] = v;
  }
}

function normalizePath(input) {
  if (!input) return '/';
  let pathOnly = `${input}`.split('?')[0];
  if (!pathOnly.startsWith('/')) pathOnly = `/${pathOnly}`;
  const compact = pathOnly.replace(/\/+/g, '/').toLowerCase();
  if (compact === '/') return '/';
  return compact.replace(/\/+$/, '') || '/';
}

function toRequestedDecisions(urls) {
  const skipped = [];
  const decisionsByPath = new Map();

  for (const raw of urls) {
    let parsed;
    try {
      parsed = new URL(raw);
    } catch {
      skipped.push({ raw, reason: 'invalid_url' });
      continue;
    }

    const host = parsed.hostname.toLowerCase();
    if (!ALLOWED_HOSTS.has(host)) {
      skipped.push({ raw, reason: `host_not_supported_in_path_rules:${host}` });
      continue;
    }

    const sourcePath = normalizePath(parsed.pathname);
    decisionsByPath.set(sourcePath, {
      source_path: sourcePath,
      status_code: 410,
      target_url: null
    });
  }

  return {
    decisions: [...decisionsByPath.values()],
    skipped
  };
}

async function fetchExistingRows(supabaseUrl, serviceKey, sourcePath) {
  const url = `${supabaseUrl}/rest/v1/redirects?select=id,source_path,target_url,status_code,match_type,is_active,priority,source_type,notes&source_path=eq.${encodeURIComponent(sourcePath)}`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed fetching existing rows (${res.status}): ${text}`);
  }
  return await res.json();
}

async function insertRows(supabaseUrl, serviceKey, rows) {
  if (!rows.length) return [];
  const url = `${supabaseUrl}/rest/v1/redirects`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(rows)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Insert failed (${res.status}): ${text}`);
  }
  return await res.json();
}

function isEquivalentActiveRow(existingRows, decision) {
  return existingRows.some((row) =>
    row.is_active === true &&
    Number(row.status_code) === Number(decision.status_code) &&
    `${row.match_type || ''}` === 'exact' &&
    `${row.target_url ?? ''}` === `${decision.target_url ?? ''}`
  );
}

async function main() {
  loadEnv();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

  const { decisions, skipped } = toRequestedDecisions(REQUESTED_URLS);

  const toInsert = [];
  const skippedAlreadySatisfied = [];
  const seen = [];

  for (const decision of decisions) {
    const existingRows = await fetchExistingRows(supabaseUrl, serviceKey, decision.source_path);
    seen.push({ source_path: decision.source_path, existing_rows: existingRows.length });

    if (isEquivalentActiveRow(existingRows, decision)) {
      skippedAlreadySatisfied.push(decision.source_path);
      continue;
    }

    toInsert.push({
      source_path: decision.source_path,
      target_url: null,
      status_code: 410,
      match_type: 'exact',
      is_active: true,
      priority: 100,
      notes: 'Requested 410 batch 2026-03-19',
      source_type: 'manual',
      source_ref: null
    });
  }

  const inserted = await insertRows(supabaseUrl, serviceKey, toInsert);

  const summary = {
    generated_at: new Date().toISOString(),
    requested_input_url_count: REQUESTED_URLS.length,
    normalized_decision_count: decisions.length,
    inserted_count: inserted.length,
    skipped_already_satisfied_count: skippedAlreadySatisfied.length,
    skipped_already_satisfied: skippedAlreadySatisfied,
    skipped_unsupported_inputs: skipped,
    seen,
    inserted_rows: inserted.map((r) => ({
      id: r.id,
      source_path: r.source_path,
      target_url: r.target_url,
      status_code: r.status_code,
      match_type: r.match_type,
      is_active: r.is_active,
      source_type: r.source_type,
      created_at: r.created_at
    }))
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
