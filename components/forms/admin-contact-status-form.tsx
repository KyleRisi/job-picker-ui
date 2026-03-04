'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ContactStatus = 'new' | 'read' | 'archived';

export function AdminContactStatusForm({
  submissionId,
  initialStatus
}: {
  submissionId: string;
  initialStatus: ContactStatus;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<ContactStatus>(initialStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function updateStatus(nextStatus: ContactStatus) {
    if (saving || nextStatus === status) return;

    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/contact-submissions/${submissionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update contact status.');
      setStatus(nextStatus);
      router.refresh();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Failed to update contact status.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className="btn-secondary !px-2 !py-1 !text-xs"
          disabled={saving || status === 'new'}
          onClick={() => updateStatus('new')}
        >
          New
        </button>
        <button
          type="button"
          className="btn-secondary !px-2 !py-1 !text-xs"
          disabled={saving || status === 'read'}
          onClick={() => updateStatus('read')}
        >
          Read
        </button>
        <button
          type="button"
          className="btn-secondary !px-2 !py-1 !text-xs"
          disabled={saving || status === 'archived'}
          onClick={() => updateStatus('archived')}
        >
          Archived
        </button>
      </div>
      {error ? <p className="text-xs font-semibold text-carnival-red">{error}</p> : null}
    </div>
  );
}
