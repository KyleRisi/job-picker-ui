'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function AdminBlogNewPage() {
  const router = useRouter();
  const startedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;

    async function createDraft() {
      const response = await fetch('/api/admin/blog/posts', {
        method: 'POST',
        cache: 'no-store'
      });
      const data = await response.json().catch(() => ({}));

      if (cancelled) return;

      if (!response.ok || !data?.id) {
        setError(typeof data?.error === 'string' ? data.error : 'Unable to create a draft right now.');
        return;
      }

      router.replace(`/admin/blog/${data.id}`);
    }

    createDraft().catch(() => {
      if (!cancelled) {
        setError('Unable to create a draft right now.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-[#f4efdf] px-6 py-8 text-[#171717]">
      <div className="mx-auto flex min-h-[70vh] max-w-3xl flex-col items-center justify-center rounded-[32px] border border-[#d7cfbb] bg-white/70 px-10 py-16 text-center shadow-[0_24px_80px_rgba(18,38,84,0.08)]">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#d8dff7] border-t-[#3154f4]" />
        <h1 className="mt-6 text-3xl font-black tracking-[-0.03em]">Creating your draft</h1>
        <p className="mt-3 max-w-xl text-base text-[#5f6373]">
          One draft is being prepared and the editor will open automatically.
        </p>
        {error ? (
          <div className="mt-6 rounded-2xl border border-[#f3b2b2] bg-[#fff4f4] px-5 py-4 text-sm text-[#a23232]">
            <p>{error}</p>
            <Link className="mt-3 inline-flex font-semibold text-[#7f1d1d] underline" href="/admin/blog">
              Return to posts
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
