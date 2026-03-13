import { NextRequest } from 'next/server';
import { z } from 'zod';
import { badRequest, ok } from '@/lib/server';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { requireAdminInApi } from '@/lib/api-auth';

const PAGE_SIZE = 20;
const VALID_STATUS = ['visible', 'hidden'] as const;
const VALID_SOURCES = ['apple', 'website', 'manual', 'scraped'] as const;

const bulkSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
  status: z.enum(VALID_STATUS)
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
  const ratingRaw = params.get('rating') || '';
  const statusRaw = params.get('status') || '';
  const sourceRaw = params.get('source') || '';

  const rating = ratingRaw ? Number.parseInt(ratingRaw, 10) : null;
  if (ratingRaw && (!Number.isFinite(rating) || rating! < 1 || rating! > 5)) {
    return badRequest('Invalid rating filter.');
  }

  if (statusRaw && !VALID_STATUS.includes(statusRaw as (typeof VALID_STATUS)[number])) {
    return badRequest('Invalid status filter.');
  }

  if (sourceRaw && !VALID_SOURCES.includes(sourceRaw as (typeof VALID_SOURCES)[number])) {
    return badRequest('Invalid source filter.');
  }

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from('reviews')
    .select('id,title,body,rating,author,country,source,status,received_at', { count: 'exact' })
    .order('received_at', { ascending: false })
    .range(from, to);

  if (rating !== null) query = query.eq('rating', rating);
  if (statusRaw) query = query.eq('status', statusRaw);
  if (sourceRaw) query = query.eq('source', sourceRaw);

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

export async function PATCH(req: NextRequest) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const parsed = bulkSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Invalid bulk update payload.');

  const supabase = createSupabaseAdminClient();
  const update = await supabase
    .from('reviews')
    .update({ status: parsed.data.status })
    .in('id', parsed.data.ids);

  if (update.error) return badRequest(update.error.message);
  return ok({ message: `Updated ${parsed.data.ids.length} review(s).` });
}
