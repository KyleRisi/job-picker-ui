import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { WorkspaceLoginForm } from '@/components/workspace/workspace-login-form';
import { env } from '@/lib/env';
import { isAdminSessionActive } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function WorkspaceLoginPage() {
  noStore();

  if (env.adminAuthDisabled || isAdminSessionActive()) {
    redirect('/workspace/dashboard/episodes');
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-100 px-4 py-8 text-slate-900">
      <div className="w-full max-w-md space-y-4">
        <div className="space-y-1 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Compendium</p>
          <h1 className="text-2xl font-semibold">Admin Workspace</h1>
        </div>
        <WorkspaceLoginForm />
      </div>
    </div>
  );
}
