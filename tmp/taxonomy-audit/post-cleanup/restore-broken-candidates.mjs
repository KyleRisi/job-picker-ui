import fs from 'node:fs';
import path from 'node:path';

const WORKDIR = process.cwd();
const AUDIT_DIR = path.join(WORKDIR, 'tmp', 'taxonomy-audit');
const POST_DIR = path.join(AUDIT_DIR, 'post-cleanup');

const CANDIDATES_CSV = path.join(POST_DIR, 'immediate-restore-candidates-2026-03-18T17-06-10Z.csv');
const PRE_SNAPSHOT_JSON = path.join(AUDIT_DIR, 'live-active-redirects.json');

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

function parseCsv(content) {
  const lines = content.trim().split(/\r?\n/);
  const headers = lines.shift().split(',');
  const rows = lines.map((line) => {
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        cols.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cols.push(cur);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = cols[idx] || '';
    });
    return row;
  });
  return rows;
}

function toCsv(rows, headers) {
  const esc = (v) => {
    const s = `${v ?? ''}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => esc(row[h])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

function normalizeExpected(value) {
  return `${value || ''}`.split('|')[0].trim();
}

async function fetchAllRedirectRows(supabaseUrl, serviceKey) {
  const url = `${supabaseUrl}/rest/v1/redirects?select=id,source_path,target_url,is_active`;
  const res = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed fetching current redirects (${res.status}): ${text}`);
  }
  return await res.json();
}

async function insertRedirectRows(supabaseUrl, serviceKey, rows) {
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

async function main() {
  loadEnv();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) throw new Error('Missing Supabase env vars');

  const candidates = parseCsv(fs.readFileSync(CANDIDATES_CSV, 'utf8'));
  const preRows = JSON.parse(fs.readFileSync(PRE_SNAPSHOT_JSON, 'utf8'));

  const expectedMap = new Map();
  for (const row of candidates) {
    expectedMap.set(row.source_path, normalizeExpected(row.expected_targets));
  }

  const preLookup = new Map();
  for (const row of preRows) {
    const key = `${row.source_path}||${row.target_url || ''}`;
    preLookup.set(key, row);
  }

  const currentRows = await fetchAllRedirectRows(supabaseUrl, serviceKey);
  const currentKeys = new Set(currentRows.map((r) => `${r.source_path}||${r.target_url || ''}`));

  const toRestore = [];
  const skippedAlreadyPresent = [];
  const unresolved = [];

  for (const sourcePath of [...expectedMap.keys()]) {
    const expected = expectedMap.get(sourcePath) || '';
    const key = `${sourcePath}||${expected}`;

    if (currentKeys.has(key)) {
      skippedAlreadyPresent.push({ source_path: sourcePath, expected_target: expected, reason: 'already_present' });
      continue;
    }

    const pre = preLookup.get(key)
      || preRows.find((r) => r.source_path === sourcePath && (r.target_url || '') === expected)
      || preRows.find((r) => r.source_path === sourcePath);

    if (!pre) {
      unresolved.push({ source_path: sourcePath, expected_target: expected, reason: 'not_found_in_pre_snapshot' });
      continue;
    }

    toRestore.push({
      source_path: pre.source_path,
      target_url: pre.target_url,
      status_code: pre.status_code,
      match_type: pre.match_type,
      is_active: pre.is_active === true,
      priority: pre.priority,
      notes: pre.notes || '',
      source_type: pre.source_type || 'manual',
      source_ref: pre.source_ref || null
    });
  }

  const inserted = [];
  const batchSize = 25;
  for (let i = 0; i < toRestore.length; i += batchSize) {
    const batch = toRestore.slice(i, i + batchSize);
    const result = await insertRedirectRows(supabaseUrl, serviceKey, batch);
    inserted.push(...result);
  }

  const ts = new Date().toISOString().replace(/[:]/g, '-').replace(/\..+/, 'Z');
  const outCsv = path.join(POST_DIR, `restored-rows-${ts}.csv`);
  const outJson = path.join(POST_DIR, `restored-rows-${ts}.json`);

  const restoredRows = inserted.map((r) => ({
    id: r.id,
    source_path: r.source_path,
    target_url: r.target_url,
    status_code: r.status_code,
    match_type: r.match_type,
    is_active: r.is_active,
    priority: r.priority,
    source_type: r.source_type,
    source_ref: r.source_ref,
    created_at: r.created_at,
    updated_at: r.updated_at
  }));

  fs.writeFileSync(outCsv, toCsv(restoredRows, [
    'id', 'source_path', 'target_url', 'status_code', 'match_type', 'is_active', 'priority', 'source_type', 'source_ref', 'created_at', 'updated_at'
  ]));

  const summary = {
    generated_at: new Date().toISOString(),
    candidates_count: candidates.length,
    to_restore_count: toRestore.length,
    restored_count: restoredRows.length,
    skipped_already_present_count: skippedAlreadyPresent.length,
    unresolved_count: unresolved.length,
    outputs: {
      restored_rows_csv: path.relative(WORKDIR, outCsv),
      restored_rows_json: path.relative(WORKDIR, outJson)
    },
    skipped_already_present: skippedAlreadyPresent,
    unresolved
  };

  fs.writeFileSync(outJson, JSON.stringify({ summary, restored_rows: restoredRows }, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
