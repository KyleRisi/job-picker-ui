'use client';

import { ChangeEvent, FormEvent, useState } from 'react';

type ImportMode = 'new' | 'existing';

export function WorkspaceJobsBulkImportPanel() {
  const [mode, setMode] = useState<ImportMode>('new');
  const [csv, setCsv] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'error'>('success');
  const [submitting, setSubmitting] = useState(false);
  const [inputKey, setInputKey] = useState(0);

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
      setMessage('Could not read this CSV file. Please re-save it as CSV and try again.');
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
      const endpoint = mode === 'existing' ? '/api/admin/jobs/bulk-existing' : '/api/admin/jobs/bulk';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv })
      });
      const bodyText = await res.text();
      let data: { message?: string; error?: string } = {};
      try {
        data = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        data = {};
      }

      const nextMessage = data.message || data.error || (res.ok ? 'Upload complete.' : 'Upload failed.');
      setMessageTone(res.ok ? 'success' : 'error');
      setMessage(nextMessage);

      if (res.ok) {
        setCsv('');
        setInputKey((value) => value + 1);
      }
    } catch {
      setMessageTone('error');
      setMessage('Upload failed due to a network or server error.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-4xl space-y-4">
      <div className="flex justify-start gap-2">
        <button
          type="button"
          onClick={() => {
            setMode('new');
            setCsv('');
            setInputKey((value) => value + 1);
            setMessage('');
          }}
          className={`inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-semibold ${
            mode === 'new'
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          New Roles
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('existing');
            setCsv('');
            setInputKey((value) => value + 1);
            setMessage('');
          }}
          className={`inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-semibold ${
            mode === 'existing'
              ? 'bg-blue-600 text-white hover:bg-blue-700'
              : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          Existing Employees
        </button>
      </div>

      <form onSubmit={onSubmit} className="mx-auto w-full space-y-3 rounded-md border border-slate-300 bg-white p-4">
        {mode === 'new' ? (
          <div className="text-sm leading-relaxed text-slate-700 break-words">
            <p>
              This option lets you import brand-new roles in bulk.
              {' '}
              <a
                className="font-semibold text-slate-800 underline hover:text-slate-900"
                href="/workspace/dashboard/jobs/template.csv"
              >
                Download the supplied CSV template
              </a>
              , fill in the details exactly as shown, save as a CSV, then upload it here.
            </p>
          </div>
        ) : (
          <div className="text-sm leading-relaxed text-slate-700 break-words">
            <p>
              This option lets you upload existing employees directly into filled roles.
              {' '}
              <a
                className="font-semibold text-slate-800 underline hover:text-slate-900"
                href="/workspace/dashboard/jobs/template-existing.csv"
              >
                Download the supplied CSV template
              </a>
              , complete it exactly as shown, save as a CSV, then upload.
            </p>
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-sm font-semibold text-slate-800" htmlFor="bulkCsvFile">Upload CSV</label>
          <input
            key={inputKey}
            id="bulkCsvFile"
            type="file"
            accept=".csv,text/csv"
            onChange={onFileChange}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
          />
        </div>

        <div className="flex justify-center gap-2">
          <button
            type="submit"
            disabled={!csv.trim() || submitting}
            className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? 'Uploading...' : 'Upload CSV'}
          </button>
        </div>

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
