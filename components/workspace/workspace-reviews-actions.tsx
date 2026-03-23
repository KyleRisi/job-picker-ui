'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type SyncResponse = {
  message?: string;
  inserted?: number;
  processed?: number;
  sources?: {
    apple?: {
      scraped?: number;
      countriesProcessed?: number;
      countriesTotal?: number;
      timedOut?: boolean;
    };
  };
};

export function WorkspaceReviewsActions() {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [feedback, setFeedback] = useState<null | { tone: 'success' | 'error'; text: string }>(null);

  async function runSync() {
    if (syncing) return;
    setSyncing(true);
    setFeedback(null);

    try {
      const response = await fetch('/api/admin/reviews/sync', { method: 'POST' });
      const payload = (await response.json().catch(() => ({}))) as SyncResponse & { error?: string };
      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to sync reviews.');
      }

      const inserted = typeof payload.inserted === 'number' ? payload.inserted : 0;
      const scraped = payload.sources?.apple?.scraped ?? 0;
      const timedOut = payload.sources?.apple?.timedOut === true;

      setFeedback({
        tone: 'success',
        text: timedOut
          ? `Sync completed with time limit reached (${inserted} added, ${scraped} scraped).`
          : `Sync completed (${inserted} added, ${scraped} scraped).`
      });
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to sync reviews.';
      setFeedback({ tone: 'error', text: message });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={runSync}
        disabled={syncing}
        className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {syncing ? 'Syncing…' : 'Sync Reviews'}
      </button>
      {feedback ? (
        <p className={`text-xs ${feedback.tone === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{feedback.text}</p>
      ) : null}
    </div>
  );
}
