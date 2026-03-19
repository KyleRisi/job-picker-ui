import { NextRequest } from 'next/server';
import { badRequest, ok } from '@/lib/server';
import { requireAdminInApi } from '@/lib/api-auth';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { buildUnifiedRedirectRows, type RedirectTableRow, type UnifiedRedirectRow } from '@/lib/redirects-unified';

const PAGE_SIZE = 25;

function parsePositiveInt(input: string | null, fallback: number): number {
  const parsed = Number.parseInt(input || '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
}

function sortUnifiedRows(rows: UnifiedRedirectRow[]): UnifiedRedirectRow[] {
  return [...rows].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;

    const aUpdated = a.updated_at ? new Date(a.updated_at).getTime() : 0;
    const bUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0;
    if (aUpdated !== bUpdated) return bUpdated - aUpdated;

    const aCreated = a.created_at ? new Date(a.created_at).getTime() : 0;
    const bCreated = b.created_at ? new Date(b.created_at).getTime() : 0;
    if (aCreated !== bCreated) return bCreated - aCreated;

    return a.source.localeCompare(b.source);
  });
}

export async function GET(req: NextRequest) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const params = req.nextUrl.searchParams;
  const page = parsePositiveInt(params.get('page'), 1);
  const queryText = (params.get('q') || '').trim().toLowerCase();
  const statusCodeRaw = (params.get('status_code') || '').trim();
  const activeRaw = (params.get('is_active') || '').trim().toLowerCase();
  const matchType = (params.get('match_type') || '').trim();
  const sourceType = (params.get('source_type') || '').trim();
  const ownerLayer = (params.get('owner_layer') || '').trim();
  const backingType = (params.get('backing_type') || '').trim();
  const editableRaw = (params.get('editable') || '').trim().toLowerCase();

  let statusCode: number | null = null;
  if (statusCodeRaw) {
    const parsed = Number.parseInt(statusCodeRaw, 10);
    if (![301, 302, 307, 308, 410].includes(parsed)) {
      return badRequest('Invalid status_code filter.');
    }
    statusCode = parsed;
  }

  if (activeRaw && !['true', 'false'].includes(activeRaw)) {
    return badRequest('Invalid is_active filter.');
  }

  if (editableRaw && !['true', 'false'].includes(editableRaw)) {
    return badRequest('Invalid editable filter.');
  }

  if (matchType && !['exact', 'prefix'].includes(matchType)) {
    return badRequest('Invalid match_type filter.');
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('redirects')
    .select('id,source_path,target_url,status_code,match_type,is_active,priority,notes,source_type,source_ref,created_at,updated_at');

  if (error) return badRequest(error.message);

  let rows = buildUnifiedRedirectRows((data || []) as RedirectTableRow[]);

  if (queryText) {
    rows = rows.filter((row) => {
      const source = row.source.toLowerCase();
      const target = (row.target || '').toLowerCase();
      const notes = row.notes_reason.toLowerCase();
      return source.includes(queryText) || target.includes(queryText) || notes.includes(queryText);
    });
  }

  if (statusCode) rows = rows.filter((row) => row.status_code === statusCode);
  if (activeRaw) rows = rows.filter((row) => row.active === (activeRaw === 'true'));
  if (editableRaw) rows = rows.filter((row) => row.editable === (editableRaw === 'true'));
  if (matchType) rows = rows.filter((row) => row.match_type === matchType);
  if (sourceType) rows = rows.filter((row) => row.source_type === sourceType);
  if (ownerLayer) rows = rows.filter((row) => row.owner_layer === ownerLayer);
  if (backingType) rows = rows.filter((row) => row.backing_type === backingType);

  const sorted = sortUnifiedRows(rows);
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const from = (safePage - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE;

  return ok({
    items: sorted.slice(from, to),
    pagination: {
      page: safePage,
      pageSize: PAGE_SIZE,
      total,
      totalPages
    }
  });
}
