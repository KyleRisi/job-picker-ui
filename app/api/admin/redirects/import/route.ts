import { NextRequest } from 'next/server';
import { z } from 'zod';
import { badRequest, ok } from '@/lib/server';
import { requireAdminInApi } from '@/lib/api-auth';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { parseRedirectCsv } from '@/lib/redirects';

const schema = z.object({
  csv: z.string().min(1),
  mode: z.enum(['upsert', 'replace']).default('upsert')
});

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Invalid import payload.');

  let rows;
  try {
    rows = parseRedirectCsv(parsed.data.csv);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Failed to parse CSV.');
  }

  if (!rows.length) return badRequest('No rows found in CSV.');

  const supabase = createSupabaseAdminClient();

  if (parsed.data.mode === 'replace') {
    const wipe = await supabase.from('redirects').delete().gte('priority', 0);
    if (wipe.error) return badRequest(wipe.error.message);
  }

  const upsert = await supabase
    .from('redirects')
    .upsert(rows, { onConflict: 'source_path,match_type' })
    .select('id');

  if (upsert.error) return badRequest(upsert.error.message);

  return ok({
    message: `Imported ${rows.length} redirect(s).`,
    imported: rows.length
  });
}
