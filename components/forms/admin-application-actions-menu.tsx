'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function AdminApplicationActionsMenu({
  id,
  broadcastedOnShow = false,
  editRoleOpen = false,
  postActionRedirectPath = '/admin',
  variant = 'admin'
}: {
  id: string;
  broadcastedOnShow?: boolean;
  editRoleOpen?: boolean;
  postActionRedirectPath?: string;
  variant?: 'admin' | 'workspace';
}) {
  const [message, setMessage] = useState('');
  const [fireLoading, setFireLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcasted, setBroadcasted] = useState(broadcastedOnShow);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const router = useRouter();
  const pathname = usePathname() || '/admin';
  const searchParams = useSearchParams();
  const summaryClassName = variant === 'workspace'
    ? 'inline-flex h-9 cursor-pointer list-none items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-500'
    : 'btn-secondary cursor-pointer list-none whitespace-nowrap';

  function closeMenu() {
    detailsRef.current?.removeAttribute('open');
  }

  useEffect(() => {
    closeMenu();
  }, [pathname, searchParams]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent | TouchEvent) {
      const details = detailsRef.current;
      if (!details?.open) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (!details.contains(target)) closeMenu();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeMenu();
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  async function fireApplicant() {
    setFireLoading(true);
    const res = await fetch(`/api/admin/applications/${id}/fire`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {
      window.location.replace(`${postActionRedirectPath}?updated=${Date.now()}`);
      return;
    }
    setMessage(data.message || data.error || 'Done');
    setFireLoading(false);
  }

  async function deleteApplication() {
    setDeleteLoading(true);
    const res = await fetch(`/api/admin/applications/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      window.location.assign(postActionRedirectPath);
      return;
    }
    setMessage(data.error || 'Could not delete application.');
    setDeleteLoading(false);
  }

  async function toggleBroadcast() {
    setBroadcastLoading(true);
    const nextBroadcasted = !broadcasted;
    const res = await fetch(`/api/admin/applications/${id}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ broadcasted: nextBroadcasted })
    });
    const data = await res.json();
    if (res.ok) {
      setBroadcasted(nextBroadcasted);
      setMessage(data.message || (nextBroadcasted ? 'Marked as broadcasted.' : 'Marked as not broadcasted.'));
      setBroadcastLoading(false);
      return;
    }
    setMessage(data.error || 'Could not update broadcast status.');
    setBroadcastLoading(false);
  }

  function toggleEditRole() {
    const params = new URLSearchParams(searchParams.toString());
    if (editRoleOpen) params.delete('edit_role');
    else params.set('edit_role', '1');
    closeMenu();
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <details ref={detailsRef} className="relative">
        <summary className={summaryClassName}>Admin Actions</summary>
        <div className="absolute right-0 z-10 mt-2 w-56 rounded-md border border-carnival-ink/20 bg-white p-1 shadow-card">
          <button
            type="button"
            className="block w-full rounded px-3 py-2 text-left hover:bg-carnival-cream"
            onClick={toggleEditRole}
            disabled={fireLoading || deleteLoading || broadcastLoading}
          >
            {editRoleOpen ? 'Close Edit Roll' : 'Edit Roll'}
          </button>
          <button
            type="button"
            className="block w-full rounded px-3 py-2 text-left hover:bg-carnival-cream"
            onClick={() => {
              closeMenu();
              toggleBroadcast();
            }}
            disabled={broadcastLoading || fireLoading || deleteLoading}
          >
            {broadcastLoading ? 'Updating broadcast...' : broadcasted ? 'Mark as Not Broadcasted' : 'Mark as Broadcasted'}
          </button>
          <button
            type="button"
            className="block w-full rounded px-3 py-2 text-left hover:bg-carnival-cream"
            onClick={() => {
              closeMenu();
              fireApplicant();
            }}
            disabled={fireLoading || deleteLoading || broadcastLoading}
          >
            {fireLoading ? 'Firing...' : 'Fire Applicant'}
          </button>
          <button
            type="button"
            className="block w-full rounded px-3 py-2 text-left hover:bg-carnival-cream"
            onClick={() => {
              closeMenu();
              deleteApplication();
            }}
            disabled={deleteLoading || fireLoading || broadcastLoading}
          >
            {deleteLoading ? 'Deleting...' : 'Delete Application'}
          </button>
        </div>
      </details>
      {message ? <p className="w-full max-w-md rounded-md bg-blue-100 p-3 text-sm">{message}</p> : null}
    </div>
  );
}
