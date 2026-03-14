import { redirect } from 'next/navigation';
import { env } from './env';
import { isAdminSessionActive } from './admin-session';

export function isAdminBypassed(): boolean {
  return env.adminAuthDisabled;
}

export function ensureAdminPageAuth() {
  if (isAdminBypassed()) return;
  if (!isAdminSessionActive()) redirect('/workspace/login');
}
