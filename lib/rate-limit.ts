import { createSupabaseAdminClient } from './supabase';

type RateLimitInput = {
  action: string;
  ip: string;
  email?: string;
  max: number;
  windowHours?: number;
  windowDays?: number;
};

export async function enforceRateLimit(input: RateLimitInput) {
  if ((process.env.RATE_LIMIT_DISABLED || '').toLowerCase() === 'true') {
    return { ok: true };
  }

  const supabase = createSupabaseAdminClient();
  const now = Date.now();
  const windowMs = input.windowDays
    ? input.windowDays * 24 * 60 * 60 * 1000
    : (input.windowHours || 1) * 60 * 60 * 1000;
  const since = new Date(now - windowMs).toISOString();

  const checks = [
    supabase
      .from('rate_limits')
      .select('id', { count: 'exact', head: true })
      .eq('action', input.action)
      .eq('ip', input.ip)
      .gte('created_at', since)
  ];

  if (input.email) {
    checks.push(
      supabase
        .from('rate_limits')
        .select('id', { count: 'exact', head: true })
        .eq('action', input.action)
        .eq('email', input.email)
        .gte('created_at', since)
    );
  }

  const results = await Promise.all(checks);
  for (const result of results) {
    if ((result.count || 0) >= input.max) {
      return { ok: false };
    }
  }

  await supabase.from('rate_limits').insert({
    action: input.action,
    ip: input.ip,
    email: input.email || null
  });

  return { ok: true };
}
