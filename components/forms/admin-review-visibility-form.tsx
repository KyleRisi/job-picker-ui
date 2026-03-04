'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdminReviewVisibilityForm({
  reviewId,
  initialStatus
}: {
  reviewId: string;
  initialStatus: 'visible' | 'hidden';
}) {
  const router = useRouter();
  const [status, setStatus] = useState<'visible' | 'hidden'>(initialStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function updateStatus(nextStatus: 'visible' | 'hidden') {
    if (saving || nextStatus === status) return;

    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update review visibility.');
      setStatus(nextStatus);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update review visibility.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="font-semibold">
        Current status: <span className="capitalize">{status}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-secondary"
          disabled={saving || status === 'hidden'}
          onClick={() => updateStatus('hidden')}
        >
          Hide Review
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={saving || status === 'visible'}
          onClick={() => updateStatus('visible')}
        >
          Unhide Review
        </button>
      </div>
      {error ? <p className="font-semibold text-carnival-red">{error}</p> : null}
    </div>
  );
}
