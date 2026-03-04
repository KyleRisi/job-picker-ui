'use client';

import { useState } from 'react';

export function AdminApplicationActions({
  id,
  broadcastedOnShow = false,
  onEditRole,
  editRoleLabel = 'Edit role'
}: {
  id: string;
  broadcastedOnShow?: boolean;
  onEditRole?: () => void;
  editRoleLabel?: string;
}) {
  const [message, setMessage] = useState('');
  const [fireLoading, setFireLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [broadcastLoading, setBroadcastLoading] = useState(false);
  const [broadcasted, setBroadcasted] = useState(broadcastedOnShow);

  async function fireApplicant() {
    setFireLoading(true);
    const res = await fetch(`/api/admin/applications/${id}/fire`, {
      method: 'POST'
    });
    const data = await res.json();
    if (res.ok) {
      window.location.replace(`/admin?updated=${Date.now()}`);
      return;
    }
    setMessage(data.message || data.error || 'Done');
    setFireLoading(false);
  }

  async function deleteApplication() {
    setDeleteLoading(true);
    const res = await fetch(`/api/admin/applications/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (res.ok) {
      window.location.assign('/admin');
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

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-primary" onClick={fireApplicant} disabled={fireLoading || deleteLoading || broadcastLoading}>
          {fireLoading ? 'Firing...' : 'Fire Applicant'}
        </button>
        <button type="button" className="btn-secondary" onClick={deleteApplication} disabled={deleteLoading || fireLoading || broadcastLoading}>
          {deleteLoading ? 'Deleting...' : 'Delete Application'}
        </button>
        {onEditRole ? (
          <button type="button" className="btn-secondary" onClick={onEditRole} disabled={fireLoading || deleteLoading || broadcastLoading}>
            {editRoleLabel}
          </button>
        ) : null}
        <div className="ml-auto">
          <button type="button" className="btn-secondary" onClick={toggleBroadcast} disabled={broadcastLoading || fireLoading || deleteLoading}>
            {broadcastLoading ? 'Updating broadcast...' : broadcasted ? 'Mark not broadcasted' : 'Mark as broadcasted'}
          </button>
        </div>
      </div>
      {message ? <p className="w-full rounded-md bg-blue-100 p-3">{message}</p> : null}
    </div>
  );
}
