import { NextResponse } from 'next/server';
import { badRequest } from '@/lib/server';
import { requireAdminInApi } from '@/lib/api-auth';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { toRedirectCsv, type RedirectRow } from '@/lib/redirects';

export async function GET() {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('redirects')
    .select('id,source_path,target_url,status_code,match_type,is_active,priority,notes,created_at,updated_at')
    .order('priority', { ascending: false })
    .order('updated_at', { ascending: false });

  if (error) return badRequest(error.message);

  const csv = toRedirectCsv((data || []) as RedirectRow[]);
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
