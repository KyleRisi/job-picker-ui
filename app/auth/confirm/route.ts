import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { env } from '@/lib/env';

export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get('token_hash');
  const type = req.nextUrl.searchParams.get('type') as 'magiclink' | null;
  const nextParam = req.nextUrl.searchParams.get('next');
  const isAdminFlow = req.nextUrl.searchParams.get('admin') === '1' || `${nextParam || ''}`.startsWith('/admin');
  const next = nextParam || (isAdminFlow ? '/admin' : '/my-job/file');

  if (tokenHash && type) {
    const successRedirect = NextResponse.redirect(new URL(next, req.url));
    const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value, options }) => {
            successRedirect.cookies.set(name, value, options as never);
          });
        }
      }
    });
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      return successRedirect;
    }
  }

  const fallbackPath = isAdminFlow ? '/admin?error=Magic link failed or expired' : '/my-job?error=Magic link failed or expired';
  return NextResponse.redirect(new URL(fallbackPath, req.url));
}
