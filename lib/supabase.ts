import { cookies } from 'next/headers';
import { createBrowserClient, createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { env } from './env';

export function createSupabaseBrowserClient() {
  return createBrowserClient(env.supabaseUrl, env.supabaseAnonKey);
}

export function createSupabaseServerClient() {
  const cookieStore = cookies();
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: Record<string, unknown> }) => {
            cookieStore.set(name, value, options as never);
          });
        } catch {
          // No-op in read-only request contexts.
        }
      }
    }
  });
}

export function createSupabaseAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}
