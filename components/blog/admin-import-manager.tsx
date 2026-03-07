'use client';

import { useState } from 'react';

export function AdminImportManager({ initialJobs }: { initialJobs: any[] }) {
  const [jobs, setJobs] = useState(initialJobs);
  const [currentPreview, setCurrentPreview] = useState<any | null>(null);
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

  async function reload() {
    const result = await requestJson('/api/admin/blog/import', undefined, 'Failed to load import jobs.');
    if (!result.ok) {
      setMessage(result.error || 'Failed to load import jobs.');
      return;
    }
    setJobs(result.data?.items || []);
  }

  return (
    <section className="space-y-5">
      <form
        className="card space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const result = await requestJson('/api/admin/blog/import/preview', {
            method: 'POST',
            body: formData
          }, 'Preview failed.');
          if (!result.ok) {
            setMessage(result.error || 'Preview failed.');
            return;
          }
          const data = result.data || {};
          setCurrentPreview(data);
          setMessage(`Previewed ${data.items?.length || 0} record(s).`);
          await reload();
        }}
      >
        <h2 className="text-2xl font-black">WordPress XML import</h2>
        <input className="input" type="file" name="file" accept=".xml,text/xml,application/xml" required />
        <button className="btn-primary" type="submit">Preview import</button>
        {message ? <p className="text-sm text-carnival-ink/70">{message}</p> : null}
      </form>

      {currentPreview ? (
        <section className="card space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black">Preview results</h3>
              <p className="text-sm text-carnival-ink/70">Job ID: {currentPreview.jobId}</p>
            </div>
            <button
              className="btn-secondary"
              type="button"
              onClick={async () => {
                const result = await requestJson(`/api/admin/blog/import/${currentPreview.jobId}/run`, { method: 'POST' }, 'Import failed.');
                const data = result.data || {};
                setMessage(result.ok ? data.log_output || 'Import finished.' : result.error || 'Import failed.');
                await reload();
              }}
            >
              Run import
            </button>
          </div>
          <div className="overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-3 font-black">Title</th>
                  <th className="py-2 pr-3 font-black">Slug</th>
                  <th className="py-2 pr-3 font-black">Status</th>
                  <th className="py-2 pr-3 font-black">Message</th>
                </tr>
              </thead>
              <tbody>
                {(currentPreview.items || []).map((item: any) => (
                  <tr key={item.sourceKey} className="border-b border-carnival-ink/10 last:border-0">
                    <td className="py-2 pr-3">{item.title}</td>
                    <td className="py-2 pr-3">{item.slug}</td>
                    <td className="py-2 pr-3 capitalize">{item.status}</td>
                    <td className="py-2 pr-3">{item.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="card">
        <h2 className="text-2xl font-black">Recent import jobs</h2>
        <div className="mt-4 space-y-2 text-sm">
          {jobs.map((job) => (
            <div key={job.id} className="rounded-xl border border-carnival-ink/10 bg-carnival-cream/20 p-3">
              <p className="font-semibold capitalize">{job.source_type} - {job.status}</p>
              <p>{new Date(job.started_at).toLocaleString()}</p>
              <p>Created {job.records_created}, failed {job.records_failed}</p>
              {job.log_output ? <p>{job.log_output}</p> : null}
            </div>
          ))}
        </div>
      </section>
    </section>
  );
}
