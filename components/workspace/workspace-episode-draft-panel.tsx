'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type PrepublishDraftStatus } from '@/lib/episode-prepublish-drafts';

type EpisodeOption = {
  id: string;
  title: string;
};

type DraftPanelSnapshot = {
  id: string;
  draft_id: string;
  episode_id: string;
  attach_method: 'auto' | 'manual' | 'conflict_resolution' | 'rollback';
  actor_id: string | null;
  created_at: string;
  restored_at: string | null;
  restored_by: string | null;
  restore_note: string | null;
};

type DraftPanelDraft = {
  id: string;
  status: PrepublishDraftStatus;
  reviewReason: string | null;
  candidateEpisodeIds: string[];
  matchedEpisodeId: string | null;
  manualMatchNotes: string;
  allowTitleCollision: boolean;
  lastMatchAttemptAt: string | null;
  matchAttemptCount: number;
};

const STATUS_CLASS: Record<PrepublishDraftStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  ready_to_match: 'bg-blue-100 text-blue-800',
  needs_review: 'bg-amber-100 text-amber-800',
  conflict: 'bg-rose-100 text-rose-800',
  attached: 'bg-emerald-100 text-emerald-800',
  archived: 'bg-slate-200 text-slate-700'
};

function formatDate(value: string | null | undefined) {
  if (!value) return 'n/a';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'n/a';
  return date.toLocaleString();
}

export function WorkspaceEpisodeDraftPanel({
  draft,
  episodes
}: {
  draft: DraftPanelDraft;
  episodes: EpisodeOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState(draft.manualMatchNotes || '');
  const [feedback, setFeedback] = useState<null | { tone: 'success' | 'error'; text: string }>(null);
  const [snapshots, setSnapshots] = useState<DraftPanelSnapshot[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState(draft.matchedEpisodeId || draft.candidateEpisodeIds[0] || '');

  const candidateEpisodeOptions = useMemo(() => {
    const deduped = new Set<string>();
    const selected: EpisodeOption[] = [];

    const priorityIds = [draft.matchedEpisodeId, ...draft.candidateEpisodeIds].filter(Boolean) as string[];
    priorityIds.forEach((id) => {
      if (deduped.has(id)) return;
      deduped.add(id);
      const episode = episodes.find((item) => item.id === id);
      if (!episode) return;
      selected.push(episode);
    });

    const remaining = episodes.filter((episode) => !deduped.has(episode.id));
    return [...selected, ...remaining];
  }, [draft.candidateEpisodeIds, draft.matchedEpisodeId, episodes]);

  useEffect(() => {
    let cancelled = false;

    async function loadSnapshots() {
      const response = await fetch(`/api/admin/blog/episodes/prepublish-drafts/${draft.id}/snapshots`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || cancelled) return;
      setSnapshots(Array.isArray(payload?.items) ? payload.items : []);
    }

    void loadSnapshots();

    return () => {
      cancelled = true;
    };
  }, [draft.id]);

  async function patchDraftWorkflow(payload: Record<string, unknown>) {
    const response = await fetch(`/api/admin/blog/episodes/prepublish-drafts/${draft.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || 'Draft update failed.');
    }
    return data;
  }

  async function runAction(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      await action();
      router.refresh();
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Draft action failed.'
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-2">
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${STATUS_CLASS[draft.status]}`}>
          {draft.status.replaceAll('_', ' ')}
        </span>
        {draft.reviewReason ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
            {draft.reviewReason}
          </p>
        ) : null}
        <p className="text-xs text-slate-600">
          Match attempts: {draft.matchAttemptCount} | Last attempt: {formatDate(draft.lastMatchAttemptAt)}
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-medium text-slate-700">Manual notes</label>
        <textarea
          className="min-h-[88px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
          placeholder="Operator notes"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void runAction(async () => {
            await patchDraftWorkflow({ manualMatchNotes: notes });
            setFeedback({ tone: 'success', text: 'Notes saved.' });
          })}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Save Notes
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          disabled={busy || draft.status === 'attached' || draft.status === 'archived'}
          onClick={() => void runAction(async () => {
            const nextStatus = draft.status === 'ready_to_match' ? 'draft' : 'ready_to_match';
            await patchDraftWorkflow({ status: nextStatus });
            setFeedback({ tone: 'success', text: nextStatus === 'ready_to_match' ? 'Draft is now ready to match.' : 'Draft moved back to draft state.' });
          })}
          className="rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 disabled:opacity-60"
        >
          {draft.status === 'ready_to_match' ? 'Mark Not Ready' : 'Mark Ready to Match'}
        </button>
        <button
          type="button"
          disabled={busy || draft.status === 'attached'}
          onClick={() => void runAction(async () => {
            if (draft.status === 'archived') {
              await patchDraftWorkflow({ unarchive: true });
              setFeedback({ tone: 'success', text: 'Draft restored from archive.' });
            } else {
              await patchDraftWorkflow({ archive: true });
              setFeedback({ tone: 'success', text: 'Draft archived.' });
            }
          })}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {draft.status === 'archived' ? 'Unarchive' : 'Archive'}
        </button>
      </div>

      <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2.5">
        <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700">
          <input
            type="checkbox"
            checked={draft.allowTitleCollision}
            onChange={() => {
              void runAction(async () => {
                if (!draft.allowTitleCollision) {
                  const confirmed = window.confirm('Allow duplicate active normalized titles for this draft?');
                  if (!confirmed) return;
                  const note = window.prompt('Enter a short operator note for this collision override:') || '';
                  if (!note.trim()) {
                    throw new Error('Collision override requires a short operator note.');
                  }
                  await patchDraftWorkflow({
                    allowTitleCollision: true,
                    confirmAllowTitleCollision: true,
                    allowTitleCollisionNote: note.trim()
                  });
                  setFeedback({ tone: 'success', text: 'Title collision override enabled.' });
                  return;
                }

                await patchDraftWorkflow({ allowTitleCollision: false });
                setFeedback({ tone: 'success', text: 'Title collision override removed.' });
              });
            }}
            disabled={busy}
          />
          Allow title collision for this draft
        </label>
      </div>

      <div className="space-y-2 rounded-md border border-slate-200 p-2.5">
        <label className="block text-xs font-medium text-slate-700">Manual attach target episode</label>
        <select
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={selectedEpisodeId}
          onChange={(event) => setSelectedEpisodeId(event.currentTarget.value)}
        >
          <option value="">Select episode...</option>
          {candidateEpisodeOptions.map((episode) => (
            <option key={episode.id} value={episode.id}>
              {episode.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy || !selectedEpisodeId || draft.status === 'attached' || draft.status === 'archived'}
          onClick={() => void runAction(async () => {
            const response = await fetch(`/api/admin/blog/episodes/prepublish-drafts/${draft.id}/attach`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ episodeId: selectedEpisodeId, method: 'manual' })
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok) {
              throw new Error(payload?.error || 'Manual attach failed.');
            }
            setFeedback({ tone: 'success', text: 'Draft attached to live episode.' });
          })}
          className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-60"
        >
          Attach Draft
        </button>
      </div>

      {draft.status === 'conflict' ? (
        <div className="space-y-2 rounded-md border border-rose-200 bg-rose-50 p-2.5">
          <p className="text-xs font-semibold text-rose-800">Conflict resolution</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !selectedEpisodeId}
              onClick={() => void runAction(async () => {
                const response = await fetch(`/api/admin/blog/episodes/prepublish-drafts/${draft.id}/resolve-conflict`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    decision: 'apply_planned',
                    episodeId: selectedEpisodeId
                  })
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                  throw new Error(payload?.error || 'Conflict resolution failed.');
                }
                setFeedback({ tone: 'success', text: 'Planned draft editorial applied.' });
              })}
              className="rounded-md border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
            >
              Apply Planned Draft
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void runAction(async () => {
                const note = window.prompt('Optional note for keeping current live editorial:') || '';
                const response = await fetch(`/api/admin/blog/episodes/prepublish-drafts/${draft.id}/resolve-conflict`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    decision: 'keep_live',
                    episodeId: selectedEpisodeId || undefined,
                    note: note.trim() || undefined
                  })
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                  throw new Error(payload?.error || 'Conflict resolution failed.');
                }
                setFeedback({ tone: 'success', text: 'Live editorial kept and draft archived.' });
              })}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Keep Live Editorial
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2 rounded-md border border-slate-200 p-2.5">
        <p className="text-xs font-semibold text-slate-700">Attach snapshots</p>
        {snapshots.length ? (
          <div className="space-y-1.5">
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="rounded border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700">
                <p>
                  {formatDate(snapshot.created_at)} | {snapshot.attach_method} | {snapshot.episode_id}
                </p>
                <p className="text-slate-500">
                  Restored: {snapshot.restored_at ? formatDate(snapshot.restored_at) : 'No'}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void runAction(async () => {
                    const restoreNote = window.prompt('Optional rollback note:') || '';
                    const runRollback = async (force: boolean) => {
                      const response = await fetch(`/api/admin/blog/episodes/prepublish-drafts/${draft.id}/rollback`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          snapshotId: snapshot.id,
                          force,
                          restoreNote: restoreNote.trim() || undefined
                        })
                      });
                      const payload = await response.json().catch(() => ({}));
                      return { response, payload };
                    };

                    const first = await runRollback(false);
                    if (first.response.status === 409 && first.payload?.requiresConfirmation) {
                      const confirmed = window.confirm('Live episode changed since this snapshot. Force rollback anyway?');
                      if (!confirmed) return;
                      const forced = await runRollback(true);
                      if (!forced.response.ok) {
                        throw new Error(forced.payload?.error || 'Forced rollback failed.');
                      }
                      setFeedback({ tone: 'success', text: 'Forced rollback completed.' });
                      return;
                    }

                    if (!first.response.ok) {
                      throw new Error(first.payload?.error || 'Rollback failed.');
                    }

                    setFeedback({ tone: 'success', text: 'Rollback completed.' });
                  })}
                  className="mt-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  Rollback to This Snapshot
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-500">No snapshots yet.</p>
        )}
      </div>

      {feedback ? (
        <p className={`text-xs ${feedback.tone === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>
          {feedback.text}
        </p>
      ) : null}
    </div>
  );
}
