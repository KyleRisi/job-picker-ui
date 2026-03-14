import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from './supabase';
import { env } from './env';

export async function requireUser() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) redirect('/my-job');
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if ((user.email || '').toLowerCase() !== env.adminEmail) {
    redirect('/workspace/login?error=forbidden');
  }
  return user;
}
