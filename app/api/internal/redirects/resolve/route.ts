import { NextRequest } from 'next/server';
import { badRequest, ok } from '@/lib/server';
import { env } from '@/lib/env';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { normalizePath, shouldSkipRedirectLookup } from '@/lib/redirects';

type ResolveRow = {
  id: string;
  source_path: string;
  target_url: string | null;
  status_code: 301 | 302 | 307 | 308 | 410;
  match_type: 'exact' | 'prefix';
  priority: number;
};

export async function GET(req: NextRequest) {
  const fromHeader = req.headers.get('x-redirect-resolve-secret');
  if (!fromHeader) return badRequest('Forbidden.', 403);

  const expected = env.redirectResolveSecret;
  if (!expected) return badRequest('REDIRECT_RESOLVE_SECRET is not configured.', 500);
  if (fromHeader !== expected) return badRequest('Forbidden.', 403);

  const rawPath = req.nextUrl.searchParams.get('path') || '/';
  const path = normalizePath(rawPath);
  if (shouldSkipRedirectLookup(path)) return ok({ item: null });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('resolve_redirect', { p_path: path });
  if (error) {
    console.error('[redirect resolve] failed:', error);
    return ok({ item: null });
  }

  const row = ((data || [])[0] || null) as ResolveRow | null;
  return ok({ item: row });
}
