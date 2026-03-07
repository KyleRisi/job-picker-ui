import { NextRequest } from 'next/server';
import { z } from 'zod';
import { badRequest, ok } from '@/lib/server';
import { requireAdminInApi } from '@/lib/api-auth';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { REDIRECT_MATCH_TYPES, REDIRECT_STATUS_CODES, normalizeRedirectInput } from '@/lib/redirects';

const PAGE_SIZE = 25;

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  is_active: z.boolean()
});

function parsePositiveInt(input: string | null, fallback: number): number {
  const parsed = Number.parseInt(input || '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const params = req.nextUrl.searchParams;
  const page = parsePositiveInt(params.get('page'), 1);
  const queryText = (params.get('q') || '').trim();
  const matchType = (params.get('match_type') || '').trim();
  const statusCodeRaw = (params.get('status_code') || '').trim();
  const activeRaw = (params.get('is_active') || '').trim().toLowerCase();
  const sourceType = (params.get('source_type') || '').trim();

  if (matchType && !REDIRECT_MATCH_TYPES.includes(matchType as (typeof REDIRECT_MATCH_TYPES)[number])) {
    return badRequest('Invalid match_type filter.');
  }

  let statusCode: number | null = null;
  if (statusCodeRaw) {
    const parsedCode = Number.parseInt(statusCodeRaw, 10);
    if (!REDIRECT_STATUS_CODES.includes(parsedCode as (typeof REDIRECT_STATUS_CODES)[number])) {
      return badRequest('Invalid status_code filter.');
    }
    statusCode = parsedCode;
  }

  if (activeRaw && !['true', 'false'].includes(activeRaw)) {
    return badRequest('Invalid is_active filter.');
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('redirects')
    .select('id,source_path,target_url,status_code,match_type,is_active,priority,notes,source_type,source_ref,created_at,updated_at', { count: 'exact' })
    .order('priority', { ascending: false })
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (queryText) {
    const escaped = queryText.replace(/,/g, '\\,');
    query = query.or(`source_path.ilike.%${escaped}%,target_url.ilike.%${escaped}%`);
  }

  if (matchType) query = query.eq('match_type', matchType);
  if (statusCode) query = query.eq('status_code', statusCode);
  if (activeRaw) query = query.eq('is_active', activeRaw === 'true');
  if (sourceType) query = query.eq('source_type', sourceType);

  const { data, error, count } = await query;
  if (error) return badRequest(error.message);

  const total = count || 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return ok({
    items: data || [],
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages
    }
  });
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  try {
    const body = await req.json();
    const payload = normalizeRedirectInput(body);

    const supabase = createSupabaseAdminClient();
    const insert = await supabase
      .from('redirects')
      .insert(payload)
      .select('id,source_path,target_url,status_code,match_type,is_active,priority,notes,source_type,source_ref,created_at,updated_at')
      .single();

    if (insert.error) return badRequest(insert.error.message);
    return ok({ item: insert.data }, 201);
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Invalid redirect payload.');
  }
}

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const parsed = bulkSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Invalid bulk update payload.');

  const supabase = createSupabaseAdminClient();
  const update = await supabase
    .from('redirects')
    .update({ is_active: parsed.data.is_active })
    .in('id', parsed.data.ids);

  if (update.error) return badRequest(update.error.message);
  return ok({ message: `Updated ${parsed.data.ids.length} redirect(s).` });
}
