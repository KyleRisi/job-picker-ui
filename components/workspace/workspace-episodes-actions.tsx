'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export function WorkspaceEpisodesActions() {
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<null | { tone: 'success' | 'error'; text: string }>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [menuOpen]);

  async function runFullCatalogReset() {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/admin/blog/episodes/reset-all-from-rss', {
        method: 'POST'
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to reset episodes from RSS.');
      }
      setFeedback({
        tone: 'success',
        text: 'Full catalog reset complete. Reloading...'
      });
      setConfirmOpen(false);
      setMenuOpen(false);
      router.refresh();
      window.setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset episodes from RSS.';
      setFeedback({
        tone: 'error',
        text: message
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
      >
        Actions
      </button>

      {menuOpen ? (
        <div className="absolute right-0 top-10 z-20 w-72 rounded-md border border-slate-200 bg-white p-1.5 shadow-xl">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              setConfirmOpen(true);
            }}
            className="flex w-full items-start justify-start rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
          >
            Reset / Re-sync Full Podcast
          </button>
        </div>
      ) : null}

      {feedback ? (
        <p className={`mt-2 text-xs ${feedback.tone === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>
          {feedback.text}
        </p>
      ) : null}

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 p-4"
          onClick={() => {
            if (busy) return;
            setConfirmOpen(false);
          }}
        >
          <div
            className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Reset full podcast from RSS"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900">Reset Full Podcast from RSS?</h2>
            <p className="mt-2 text-sm text-slate-700">
              This will run a full catalog RSS sync and clear editorial overrides for all episodes.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>Source fields are refreshed from RSS across the full catalog.</li>
              <li>Editorial title, excerpt, body, SEO, hero, and social overrides are cleared for all episodes.</li>
              <li>Taxonomy and author assignments are preserved.</li>
            </ul>
            <p className="mt-3 text-sm font-medium text-rose-700">
              This action is global and may overwrite your editorial work.
            </p>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={busy}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runFullCatalogReset}
                disabled={busy}
                className="inline-flex h-9 items-center justify-center rounded-md bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Resetting...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

