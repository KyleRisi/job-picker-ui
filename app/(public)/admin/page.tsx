import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { env } from '@/lib/env';
import { isAdminSessionActive } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AdminPage() {
  noStore();

  if (env.adminAuthDisabled || isAdminSessionActive()) {
    redirect('/workspace/dashboard');
  }

  redirect('/workspace/login');
}
