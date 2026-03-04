import { createSupabaseAdminClient } from './supabase';
import { env } from './env';

export async function generateMagicLink(email: string, redirectPath: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${env.appBaseUrl}/auth/confirm` }
  });

  if (error) throw error;
  const tokenHash = data?.properties?.hashed_token;
  if (!tokenHash) throw new Error('Unable to generate magic link');
  const next = encodeURIComponent(redirectPath);
  return `${env.appBaseUrl}/auth/confirm?token_hash=${tokenHash}&type=magiclink&next=${next}`;
}
