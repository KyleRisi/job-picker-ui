import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(projectRoot, 'lib/reviews-data.json');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function normalizeRow(input) {
  const parsedDate = new Date(input?.date || '');
  const receivedAt = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
  const rating = Number.isFinite(Number(input?.rating)) ? Number(input.rating) : 5;
  const clampedRating = Math.min(5, Math.max(1, Math.trunc(rating)));

  const title = String(input?.title || '').trim();
  const body = String(input?.body || '').trim();
  const externalId = String(input?.id || '').trim();
  const platform = String(input?.platform || '').trim().toLowerCase();
  const source = platform === 'apple' || platform === 'website' ? platform : 'manual';

  if (!externalId || !title || !body) return null;

  return {
    external_id: externalId,
    title,
    body,
    rating: clampedRating,
    author: String(input?.author || 'Anonymous').trim() || 'Anonymous',
    country: String(input?.country || '').trim(),
    source,
    status: 'visible',
    received_at: receivedAt
  };
}

async function main() {
  const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL');
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const tableCheck = await supabase.from('reviews').select('id').limit(1);
  if (tableCheck.error) {
    throw new Error(
      `${tableCheck.error.message}. Apply migration supabase/migrations/0008_create_reviews_table.sql first.`
    );
  }

  const raw = await fs.readFile(sourcePath, 'utf8');
  const parsed = JSON.parse(raw);
  const inputRows = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.reviews) ? parsed.reviews : [];
  const rows = inputRows.map(normalizeRow).filter(Boolean);

  if (!rows.length) {
    console.log(`No valid rows found in ${path.relative(projectRoot, sourcePath)}`);
    return;
  }

  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase
      .from('reviews')
      .upsert(chunk, { onConflict: 'external_id', ignoreDuplicates: true });
    if (error) {
      throw new Error(`Upsert failed at chunk ${Math.floor(i / chunkSize) + 1}: ${error.message}`);
    }
  }

  const countResult = await supabase.from('reviews').select('id', { count: 'exact', head: true });
  if (countResult.error) {
    throw new Error(`Imported, but failed to fetch final count: ${countResult.error.message}`);
  }

  console.log(`Processed ${rows.length} reviews from ${path.relative(projectRoot, sourcePath)} (insert-only mode)`);
  console.log(`Current total rows in reviews table: ${countResult.count ?? 0}`);
}

main().catch((error) => {
  console.error('Apple review import failed:');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
