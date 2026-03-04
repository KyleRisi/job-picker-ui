import { env } from './env';
import { isAdminSessionActive } from './admin-session';

export async function requireAdminInApi() {
  if (env.adminAuthDisabled) {
    return {
      id: 'dev-admin-bypass',
      email: env.adminEmail || 'dev-admin@local.test'
    };
  }

  if (!isAdminSessionActive()) {
    return null;
  }

  return {
    id: 'admin-password-session',
    email: env.adminEmail
  };
}
