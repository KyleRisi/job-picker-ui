import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase';
import { env } from '@/lib/env';
import { isAdminSessionActive } from '@/lib/admin-session';

function getLegacyAdminUser() {
  if (env.adminAuthDisabled || isAdminSessionActive()) {
    return {
      id: 'legacy-admin-session',
      email: env.adminEmail || 'admin@local.test'
    };
  }
  return null;
}

export async function getBlogAdminUser() {
  const legacyAdminUser = getLegacyAdminUser();
  if (legacyAdminUser) return legacyAdminUser;

  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) return null;
  if ((user.email || '').toLowerCase() !== env.adminEmail) return null;
  return user;
}

export async function requireBlogAdminUser() {
  const user = await getBlogAdminUser();
  if (!user) redirect('/workspace/login?error=blog-auth');
  return user;
}

export async function requireBlogAdminApiUser() {
  const user = await getBlogAdminUser();
  return user;
}

/**
 * Convenience wrapper for API route handlers.
 * Returns a 401 Response if the user is not an admin, otherwise returns the user.
 * Usage: const guard = await guardBlogAdminApi(); if (guard.response) return guard.response;
 */
export async function guardBlogAdminApi(): Promise<
  { user: NonNullable<Awaited<ReturnType<typeof getBlogAdminUser>>>; response?: undefined }
  | { user?: undefined; response: Response }
> {
  const user = await getBlogAdminUser();
  if (!user) {
    return { response: Response.json({ error: 'Unauthorized.' }, { status: 401 }) };
  }
  return { user };
}
