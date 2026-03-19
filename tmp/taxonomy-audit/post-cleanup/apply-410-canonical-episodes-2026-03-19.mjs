import fs from 'node:fs';
import path from 'node:path';

const WORKDIR = process.cwd();

// These are the episode slugs from the original 410 batch that need canonical /episodes/ rows
const EPISODE_SLUGS = [
  'marie-antoinette-her-life-and-legacy-misunderstood-and-misrepresented',
  'bonus-its-raining-meat',
  'the-isabella-gardner-museum-heist-inside-the-largest-art-theft-in-history',
  'the-miracle-of-the-andes-the-story-of-a-group-of-survivors-of-a-plane-crash-in-the-andes-in-1972',
  'the-radium-girls-a-tragic-tale-of-courage-and-determination',
  'the-eternal-empire-behind-the-vatican-veil',
  'the-turpin-family-the-dark-tale-of-the-worst-child-abuse-case-in-modern-american-history',
  'the-mysterious-death-of-jonbenet-ramsey-a-closer-look-into-this-tragic-murder',
  'the-great-beanie-baby-bubble-the-rise-and-fall-of-the-popular-toy-craze-of-the-1990s',
  'gone-in-the-night-the-dupont-de-ligonnes-familys-disappearance',
  'the-roswell-incident-unraveling-the-truth-behind-americas-most-famous-ufo-crash',
  'the-great-train-robbery-britains-most-famous-heist-and-international-manhunt',
  'the-jennifer-pan-story-a-deadly-betrayal',
  'the-voynich-manuscript-investigating-the-cryptic-text-that-has-puzzled-experts-for-centuries',
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

async function fetchExisting(supabaseUrl, serviceKey, sourcePath) {
  const url = `${supabaseUrl}/rest/v1/redirects?select=id,source_path,status_code,is_active&source_path=eq.${encodeURIComponent(sourcePath)}`;
  const res = await fetch(url, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }
  });
  if (!res.ok) throw new Error(`Fetch failed (${res.status}): ${await res.text()}`);
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
  if (!res.ok) throw new Error(`Insert failed (${res.status}): ${await res.text()}`);
  return await res.json();
}

async function main() {
  loadEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const toInsert = [];
  const skipped = [];

  for (const slug of EPISODE_SLUGS) {
    const canonicalPath = `/episodes/${slug}`;
    const existing = await fetchExisting(supabaseUrl, serviceKey, canonicalPath);
    if (existing.length > 0) {
      skipped.push({ path: canonicalPath, reason: 'already_exists', existing_status: existing[0].status_code });
      continue;
    }
    toInsert.push({
      source_path: canonicalPath,
      target_url: null,
      status_code: 410,
      match_type: 'exact',
      is_active: true,
      priority: 100,
      source_type: 'manual',
      notes: 'Canonical /episodes/ 410 for retired episode (companion to legacy path row)'
    });
  }

  let inserted = [];
  if (toInsert.length) {
    inserted = await insertRows(supabaseUrl, serviceKey, toInsert);
  }

  const summary = {
    total_slugs: EPISODE_SLUGS.length,
    inserted_count: inserted.length,
    skipped_count: skipped.length,
    skipped,
    inserted_paths: inserted.map(r => r.source_path)
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
