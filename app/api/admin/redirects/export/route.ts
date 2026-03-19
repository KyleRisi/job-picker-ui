import { NextResponse } from 'next/server';
import { badRequest } from '@/lib/server';
import { requireAdminInApi } from '@/lib/api-auth';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { buildUnifiedRedirectRows, type RedirectTableRow, type UnifiedRedirectRow } from '@/lib/redirects-unified';

const EXPORT_HEADERS: Array<keyof UnifiedRedirectRow> = [
  'id',
  'source',
  'target',
  'status_code',
  'owner_layer',
  'source_type',
  'editable',
  'rule_type',
  'notes_reason',
  'active',
  'created_at',
  'updated_at',
  'backing_type',
  'backing_ref',
  'read_only_reason',
  'match_type',
  'priority'
];

function escapeCsv(value: unknown): string {
  const text = `${value ?? ''}`;
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
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

function toUnifiedRedirectCsv(rows: UnifiedRedirectRow[]): string {
  const lines = [EXPORT_HEADERS.join(',')];
  for (const row of rows) {
    const line = EXPORT_HEADERS.map((key) => escapeCsv(row[key])).join(',');
    lines.push(line);
  }
  return `${lines.join('\n')}\n`;
}

export async function GET() {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('redirects')
    .select('id,source_path,target_url,status_code,match_type,is_active,priority,notes,source_type,source_ref,created_at,updated_at')
    .order('priority', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) return badRequest(error.message);

  const unifiedRows = buildUnifiedRedirectRows((data || []) as RedirectTableRow[]);
  const csv = toUnifiedRedirectCsv(sortUnifiedRows(unifiedRows));
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="redirects-${timestamp}.csv"`,
      'Cache-Control': 'no-store'
    }
  });
}
