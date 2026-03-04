'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function AdminContactDeleteButton({ submissionId }: { submissionId: string }) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function confirmDelete() {
    if (deleting) return;
    setError('');
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/contact-submissions/${submissionId}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || 'Failed to delete contact submission.');
        return;
      }
      setConfirmOpen(false);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-carnival-red text-white transition hover:bg-red-700 disabled:opacity-50"
        onClick={() => {
          setError('');
          setConfirmOpen(true);
        }}
        disabled={deleting}
        aria-label="Delete message"
        title="Delete message"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
      </button>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-carnival-ink/20 bg-white p-5 text-left shadow-card">
            <h3 className="text-left text-lg font-bold">Delete message?</h3>
            <p className="mt-2 text-left text-sm text-carnival-ink/85">
              This will permanently remove the contact submission from the dashboard.
            </p>
            {error ? (
              <p className="mt-2 rounded-md bg-red-100 px-3 py-2 text-xs font-semibold text-carnival-red">{error}</p>
            ) : null}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmOpen(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
