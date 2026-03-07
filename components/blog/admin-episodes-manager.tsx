'use client';

import { useState } from 'react';

export function AdminBlogEpisodesManager({
  initialEpisodes,
  initialLogs
}: {
  initialEpisodes: any[];
  initialLogs: any[];
}) {
  const [episodes, setEpisodes] = useState(initialEpisodes);
  const [logs, setLogs] = useState(initialLogs);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');

  async function requestJson(url: string, init?: RequestInit, fallbackError = 'Request failed.') {
    try {
      const response = await fetch(url, { cache: 'no-store', ...init });
      const data = await response.json().catch(() => ({}));
      return {
        ok: response.ok,
        data,
        error: response.ok ? null : data?.error || fallbackError
      };
    } catch {
      return {
        ok: false,
        data: null,
        error: 'Network error. Please try again.'
      };
    }
  }

  async function reload(q = query) {
    const result = await requestJson(`/api/admin/blog/episodes?q=${encodeURIComponent(q)}`, undefined, 'Failed to load episodes.');
    if (!result.ok) {
      setMessage(result.error || 'Failed to load episodes.');
      return;
    }
    setEpisodes(result.data?.items || []);
    setLogs(result.data?.logs || []);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input className="input max-w-sm" value={query} onChange={(event) => setQuery(event.currentTarget.value)} placeholder="Search episodes" />
        <button className="btn-secondary" type="button" onClick={() => void reload(query)}>Search</button>
        <button
          className="btn-primary"
          type="button"
          onClick={async () => {
            setMessage('Syncing RSS feed…');
            const result = await requestJson('/api/admin/blog/episodes', { method: 'POST' }, 'Sync failed.');
            const data = result.data || {};
            setMessage(result.ok ? `Sync complete. Added ${data.recordsAdded || 0}, updated ${data.recordsUpdated || 0}.` : result.error || 'Sync failed.');
            await reload();
          }}
        >
          Sync episodes from RSS
        </button>
      </div>
      {message ? <p className="rounded-md bg-blue-100 p-3 text-sm">{message}</p> : null}

      <div className="overflow-auto rounded-2xl border-2 border-carnival-ink/15 bg-white shadow-card">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-carnival-gold/25">
            <tr>
              <th className="px-4 py-3 font-black">Title</th>
              <th className="px-4 py-3 font-black">Published</th>
              <th className="px-4 py-3 font-black">Visible</th>
              <th className="px-4 py-3 font-black">Archived</th>
            </tr>
          </thead>
          <tbody>
            {episodes.map((episode) => (
              <tr key={episode.id} className="border-b border-carnival-ink/10 last:border-0">
                <td className="px-4 py-3">
                  <p className="font-semibold">{episode.title}</p>
                  <p className="text-xs text-carnival-ink/60">{episode.slug}</p>
                </td>
                <td className="px-4 py-3">{episode.published_at ? new Date(episode.published_at).toLocaleDateString('en-GB') : 'Unknown'}</td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={episode.is_visible}
                    aria-label={`Toggle visibility for ${episode.title}`}
                    onChange={async (event) => {
                      const result = await requestJson(`/api/admin/blog/episodes/${episode.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ is_visible: event.currentTarget.checked, is_archived: episode.is_archived, transcript: episode.transcript, show_notes: episode.show_notes })
                      }, 'Failed to update episode.');
                      if (!result.ok) {
                        setMessage(result.error || 'Failed to update episode.');
                        return;
                      }
                      if (result.data?.id) {
                        setEpisodes((current) => current.map((row) => (row.id === result.data.id ? result.data : row)));
                      }
                    }}
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={episode.is_archived}
                    aria-label={`Toggle archived for ${episode.title}`}
                    onChange={async (event) => {
                      const result = await requestJson(`/api/admin/blog/episodes/${episode.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ is_visible: episode.is_visible, is_archived: event.currentTarget.checked, transcript: episode.transcript, show_notes: episode.show_notes })
                      }, 'Failed to update episode.');
                      if (!result.ok) {
                        setMessage(result.error || 'Failed to update episode.');
                        return;
                      }
                      if (result.data?.id) {
                        setEpisodes((current) => current.map((row) => (row.id === result.data.id ? result.data : row)));
                      }
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="card">
        <h2 className="text-2xl font-black">Recent sync logs</h2>
        <div className="mt-4 space-y-2 text-sm">
          {logs.map((log) => (
            <div key={log.id} className="rounded-xl border border-carnival-ink/10 bg-carnival-cream/25 p-3">
              <p className="font-semibold capitalize">{log.status}</p>
              <p>{new Date(log.started_at).toLocaleString()} to {log.completed_at ? new Date(log.completed_at).toLocaleString() : 'running'}</p>
              <p>Added {log.records_added}, updated {log.records_updated}, skipped {log.records_skipped}</p>
              {log.error_summary ? <p className="text-carnival-red">{log.error_summary}</p> : null}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
