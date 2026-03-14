'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function WorkspaceLogoutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    if (loading) return;
    setLoading(true);

    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } finally {
      router.replace('/workspace/login');
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={onLogout}
      disabled={loading}
      className={
        className ||
        'inline-flex w-full items-center justify-center rounded-md border border-slate-500 px-3 py-2 text-sm font-medium text-slate-100 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-70'
      }
    >
      {loading ? 'Signing out...' : 'Log out'}
    </button>
  );
}
