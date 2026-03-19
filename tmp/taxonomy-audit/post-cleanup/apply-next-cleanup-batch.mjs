import fs from 'node:fs';
import path from 'node:path';

const WORKDIR = process.cwd();

const DECISIONS = [
  { source_path: '/about', status_code: 301, target_url: '/' },
  { source_path: '/home2', status_code: 301, target_url: '/' },
  { source_path: '/podcast/the-compendium-of-fascinating-things', status_code: 301, target_url: '/' },
  {
    source_path: '/video/milli-vanilli-the-real-story-behind-greatest-lip-sync-scandal-in-music-history',
    status_code: 301,
    target_url: '/episodes/milli-vanilli-the-real-story-behind-greatest-lip-sync-scandal-in-music-history'
  },
  {
    source_path: '/video/the-1989-oscars-a-night-hollywood-wants-you-to-forget',
    status_code: 301,
    target_url: '/episodes/the-61st-academy-awards-the-worst-oscars-ceremony-ever'
  },
  {
    source_path: '/video/who-shot-jill-dando-the-mystery-behind-her-infamous-murder',
    status_code: 301,
    target_url: '/episodes/who-killed-jill-dando-the-mystery-behind-her-infamous-murder'
  },
  { source_path: '/podcast/the-compendium-of-fascinating-things-patreon', status_code: 410, target_url: null },
  { source_path: '/podcast/the-compendium-of-fascinating-things/season/2', status_code: 410, target_url: null },
  { source_path: '/blog/propagation-test-2026-03-07t20-52-21-374z', status_code: 410, target_url: null },
  { source_path: '/blog/slug-redirect-check-2026-03-07t21-06-28-972z', status_code: 410, target_url: null }
];

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

  const toInsert = [];
  const skippedAlreadySatisfied = [];
  const seen = [];

  for (const decision of DECISIONS) {
    const existingRows = await fetchExistingRows(supabaseUrl, serviceKey, decision.source_path);
    seen.push({ source_path: decision.source_path, existing_rows: existingRows.length });

    if (isEquivalentActiveRow(existingRows, decision)) {
      skippedAlreadySatisfied.push(decision.source_path);
      continue;
    }

    toInsert.push({
      source_path: decision.source_path,
      target_url: decision.target_url,
      status_code: decision.status_code,
      match_type: 'exact',
      is_active: true,
      priority: 100,
      notes: `Post-cleanup focused batch 2026-03-18 (${decision.status_code === 410 ? 'retire' : 'restore'})`,
      source_type: 'manual',
      source_ref: null
    });
  }

  const inserted = await insertRows(supabaseUrl, serviceKey, toInsert);

  const summary = {
    generated_at: new Date().toISOString(),
    requested_decisions: DECISIONS.length,
    inserted_count: inserted.length,
    skipped_already_satisfied_count: skippedAlreadySatisfied.length,
    skipped_already_satisfied: skippedAlreadySatisfied,
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
