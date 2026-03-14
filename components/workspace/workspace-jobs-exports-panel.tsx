'use client';

import { ChangeEvent, FormEvent, useState } from 'react';

type ExportType = 'active-roles' | 'applications' | 'exit-interviews';

export function WorkspaceJobsExportsPanel() {
  const [csv, setCsv] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inputKey, setInputKey] = useState(0);
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success');

  function download(type: ExportType) {
    window.location.href = `/api/admin/exports/${type}?t=${Date.now()}`;
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setMessage('');
    if (!file) return;

    try {
      const text = await file.text();
      setCsv(text);
    } catch {
      setCsv('');
      setInputKey((value) => value + 1);
      setMessageTone('error');
      setMessage('Could not read this CSV file. Please re-save as CSV and try again.');
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!csv.trim()) {
      setMessageTone('error');
      setMessage('Choose a CSV file first.');
      return;
    }

    setSubmitting(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/jobs/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv })
      });
      const data = await res.json().catch(() => ({}));
      const nextMessage = data.message || data.error || (res.ok ? 'Update complete.' : 'Update failed.');

      setMessageTone(res.ok ? 'success' : 'error');
      setMessage(nextMessage);
      if (res.ok) {
        setCsv('');
        setInputKey((value) => value + 1);
      }
    } catch {
      setMessageTone('error');
      setMessage('Update failed due to a network or server error.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => download('active-roles')}
          className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Export active roles CSV
        </button>
        <button
          type="button"
          onClick={() => download('applications')}
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Export archived applications CSV
        </button>
        <button
          type="button"
          onClick={() => download('exit-interviews')}
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Export exit interviews CSV
        </button>
      </div>

      <form onSubmit={onSubmit} className="max-w-xl space-y-3 rounded-md border border-slate-300 bg-white p-4">
        <h2 className="text-lg font-semibold text-slate-900">Upload Edited Active Roles CSV</h2>
        <p className="text-sm text-slate-700">
          Download <strong>Export active roles CSV</strong>, edit rows in place (match by <code>job_ref</code>), then upload to update roles.
        </p>
        <input
          key={inputKey}
          type="file"
          accept=".csv,text/csv"
          onChange={onFileChange}
          className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
        />
        <button
          type="submit"
          disabled={!csv.trim() || submitting}
          className="inline-flex h-9 items-center justify-center rounded-md bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? 'Updating...' : 'Upload and Update'}
        </button>

        {message ? (
          <p
            className={`rounded-md border px-3 py-2 text-sm ${
              messageTone === 'success'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-rose-300 bg-rose-50 text-rose-800'
            }`}
          >
            {message}
          </p>
        ) : null}
      </form>
    </section>
  );
}

