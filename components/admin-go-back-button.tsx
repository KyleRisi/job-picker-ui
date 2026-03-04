'use client';

import { useRouter } from 'next/navigation';

export function AdminGoBackButton({
  fallbackHref = '/admin',
  className = 'inline-block text-sm font-semibold underline'
}: {
  fallbackHref?: string;
  className?: string;
}) {
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <button type="button" className={className} onClick={handleBack}>
      Go Back
    </button>
  );
}
