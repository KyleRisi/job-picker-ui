'use client';

import { useSearchParams } from 'next/navigation';

export function ClientMessage() {
  const params = useSearchParams();
  const success = params.get('success');
  const error = params.get('error');
  if (!success && !error) return null;

  return (
    <div className={`mb-4 rounded-md p-3 ${error ? 'bg-red-100 text-red-900' : 'bg-green-100 text-green-900'}`} role="status">
      {error || success}
    </div>
  );
}
