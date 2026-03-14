import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { WorkspaceShell } from '@/components/workspace/workspace-shell';
import { getAdminEmailFromSessionCookie, isAdminSessionActive } from '@/lib/admin-session';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function WorkspaceDashboardLayout({ children }: { children: React.ReactNode }) {
  noStore();

  if (!env.adminAuthDisabled && !isAdminSessionActive()) {
    redirect('/workspace/login');
  }

  const cookieEmail = getAdminEmailFromSessionCookie();
  const adminEmail = env.adminAuthDisabled
    ? env.adminEmail || 'dev-admin@local.test'
    : cookieEmail || env.adminEmail || 'admin';

  return (
    <WorkspaceShell showBypassBanner={env.adminAuthDisabled} adminEmail={adminEmail}>
      {children}
    </WorkspaceShell>
  );
}
