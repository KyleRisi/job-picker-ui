'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CreatePostButton({
  className = 'btn-primary',
  label = 'Create draft'
}: {
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError('');
          try {
            const response = await fetch('/api/admin/blog/posts', { method: 'POST' });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data?.id) {
              setError(data?.error || 'Failed to create post. Please try again.');
              setLoading(false);
              return;
            }
            router.push(`/admin/blog/${data.id}`);
          } catch {
            setError('Network error. Please try again.');
            setLoading(false);
          }
        }}
      >
        {loading ? 'Creating…' : label}
      </button>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </>
  );
}
