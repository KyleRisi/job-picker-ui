import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const csvPath = process.argv[2] || 'docs/templates/freaky-suggestions-import.csv';
const absPath = path.resolve(csvPath);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!fs.existsSync(absPath)) {
  console.error(`CSV not found: ${absPath}`);
  process.exit(1);
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

function normalizeTitle(value) {
  return `${value || ''}`
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value) {
  return `${value || ''}`.replace(/\s+/g, ' ').trim();
}

function parseBool(value, fallback = true) {
  const v = `${value || ''}`.trim().toLowerCase();
  if (!v) return fallback;
  return v === 'true' || v === '1' || v === 'yes';
}

function parseDate(value) {
  const raw = `${value || ''}`.trim();
  if (!raw) return new Date().toISOString();

  const native = new Date(raw);
  if (Number.isFinite(native.getTime())) return native.toISOString();

  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const hour = Number(m[4] || 0);
    const minute = Number(m[5] || 0);
    const dt = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
    if (Number.isFinite(dt.getTime())) return dt.toISOString();
  }

  return new Date().toISOString();
}

function parseCsv(text) {
  const rows = [];
  let cur = '';
  let row = [];
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      cur += ch;
      i += 1;
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (ch === ',') {
      row.push(cur);
      cur = '';
      i += 1;
      continue;
    }

    if (ch === '\n') {
      row.push(cur);
      cur = '';
      rows.push(row);
      row = [];
      i += 1;
      continue;
    }

    if (ch === '\r') {
      i += 1;
      continue;
    }

    cur += ch;
    i += 1;
  }

  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }

  if (!rows.length) return [];

  let headers = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ''));
  headers = headers.filter((h) => h !== '');

  const out = [];
  for (let r = 1; r < rows.length; r += 1) {
    const vals = rows[r];
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (vals[idx] ?? '').trim();
    });
    if (Object.values(obj).every((v) => `${v}`.trim() === '')) continue;
    out.push(obj);
  }
  return out;
}

async function getOrCreateIdentityId(email) {
  const normalized = `${email || ''}`.trim().toLowerCase();
  if (!normalized) return null;

  const existing = await supabase
    .from('freaky_identities')
    .select('id')
    .eq('email_normalized', normalized)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data?.id) return existing.data.id;

  const inserted = await supabase
    .from('freaky_identities')
    .insert({
      email: normalized,
      email_normalized: normalized,
      email_verified_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (inserted.error || !inserted.data?.id) throw inserted.error || new Error('Could not create identity');
  return inserted.data.id;
}

async function resolveTopic(row) {
  const termIdRaw = `${row.topic_term_id || ''}`.trim();
  const slugRaw = `${row.topic_slug || ''}`.trim();
  const nameRaw = `${row.topic_name || ''}`.trim();

  if (termIdRaw) {
    const q = await supabase
      .from('discovery_terms')
      .select('id,slug,name')
      .eq('id', termIdRaw)
      .eq('term_type', 'topic')
      .eq('is_active', true)
      .maybeSingle();
    if (!q.error && q.data) return q.data;
  }

  if (slugRaw) {
    const q = await supabase
      .from('discovery_terms')
      .select('id,slug,name')
      .ilike('slug', slugRaw)
      .eq('term_type', 'topic')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (!q.error && q.data) return q.data;
  }

  if (nameRaw) {
    const q = await supabase
      .from('discovery_terms')
      .select('id,slug,name')
      .ilike('name', nameRaw)
      .eq('term_type', 'topic')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();
    if (!q.error && q.data) return q.data;
  }

  return null;
}

function normalizeStatus(value) {
  const v = `${value || ''}`.trim();
  const allowed = new Set(['pending_verification', 'published', 'hidden', 'spam', 'removed', 'duplicate', 'expired_unverified']);
  if (allowed.has(v)) return v;
  return 'published';
}

const raw = fs.readFileSync(absPath, 'utf8');
const rows = parseCsv(raw);

if (!rows.length) {
  console.log('No rows found to import.');
  process.exit(0);
}

console.log(`Parsed ${rows.length} rows from ${csvPath}`);

let inserted = 0;
let skipped = 0;
let failed = 0;

const externalMap = new Map();
const pendingDuplicateLinks = [];

for (const row of rows) {
  try {
    const title = normalizeText(row.title);
    const description = normalizeText(row.description);
    const externalKey = normalizeText(row.external_key);

    if (!title || !description) {
      skipped += 1;
      continue;
    }

    const createdAt = parseDate(row.created_at);
    const status = normalizeStatus(row.status);
    const isVisible = status === 'published' ? parseBool(row.is_visible, true) : false;
    const fullName = normalizeText(row.submitted_full_name);
    const country = normalizeText(row.submitted_country);

    // Idempotency guard: skip if same normalized title + exact description already exists.
    const existing = await supabase
      .from('freaky_suggestions')
      .select('id')
      .eq('title_normalized', normalizeTitle(title))
      .eq('description', description)
      .limit(1)
      .maybeSingle();

    if (existing.error) throw existing.error;
    if (existing.data?.id) {
      skipped += 1;
      if (externalKey) externalMap.set(externalKey, existing.data.id);
      continue;
    }

    const identityId = await getOrCreateIdentityId(row.submitter_email);
    const topic = await resolveTopic(row);

    const payload = {
      title,
      title_normalized: normalizeTitle(title),
      description,
      status,
      is_visible: isVisible,
      upvote_count: 0,
      submitted_by_identity_id: identityId,
      verification_completed_at: status === 'published' ? createdAt : null,
      created_at: createdAt,
      updated_at: new Date().toISOString(),
      submitted_name: fullName,
      submitted_full_name: fullName,
      submitted_country: country,
      topic_term_id: topic?.id || null,
      topic_slug: topic?.slug || '',
      topic_name: topic?.name || ''
    };

    const created = await supabase
      .from('freaky_suggestions')
      .insert(payload)
      .select('id')
      .single();

    if (created.error || !created.data?.id) throw created.error || new Error('Insert failed');

    inserted += 1;
    if (externalKey) externalMap.set(externalKey, created.data.id);

    const duplicateOfKey = normalizeText(row.duplicate_of_external_key);
    if (duplicateOfKey) {
      pendingDuplicateLinks.push({ source: created.data.id, duplicateOfKey });
    }
  } catch (error) {
    failed += 1;
    console.error('Row import failed:', row.external_key || row.title || 'unknown', error?.message || error);
  }
}

let duplicateLinked = 0;
for (const entry of pendingDuplicateLinks) {
  const targetId = externalMap.get(entry.duplicateOfKey);
  if (!targetId) continue;

  const updated = await supabase
    .from('freaky_suggestions')
    .update({
      duplicate_of_suggestion_id: targetId,
      status: 'duplicate',
      is_visible: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', entry.source);

  if (!updated.error) duplicateLinked += 1;
}

console.log(JSON.stringify({
  file: csvPath,
  totalRows: rows.length,
  inserted,
  skipped,
  failed,
  duplicateLinked
}, null, 2));
