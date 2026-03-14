'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ContactStatus = 'new' | 'read' | 'archived';

export function AdminContactStatusForm({
  submissionId,
  initialStatus,
  variant = 'admin'
}: {
  submissionId: string;
  initialStatus: ContactStatus;
  variant?: 'admin' | 'workspace';
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

  const buttonClassName = variant === 'workspace'
    ? 'inline-flex h-7 items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'
    : 'btn-secondary !px-2 !py-1 !text-xs';
  const errorClassName = variant === 'workspace'
    ? 'text-xs font-semibold text-rose-700'
    : 'text-xs font-semibold text-carnival-red';

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={buttonClassName}
          disabled={saving || status === 'new'}
          onClick={() => updateStatus('new')}
        >
          New
        </button>
        <button
          type="button"
          className={buttonClassName}
          disabled={saving || status === 'read'}
          onClick={() => updateStatus('read')}
        >
          Read
        </button>
        <button
          type="button"
          className={buttonClassName}
          disabled={saving || status === 'archived'}
          onClick={() => updateStatus('archived')}
        >
          Archived
        </button>
      </div>
      {error ? <p className={errorClassName}>{error}</p> : null}
    </div>
  );
}
