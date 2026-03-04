'use client';

import { ChangeEvent, FormEvent, useState } from 'react';

export function AdminActiveRolesUpload() {
  const [csv, setCsv] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inputKey, setInputKey] = useState(0);

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setMessage('');
    if (!file) return;
    try {
      const text = await file.text();
      setCsv(text);
    } catch {
      setCsv('');
      setInputKey((k) => k + 1);
      setMessage('Could not read this CSV file. Please re-save as CSV and try again.');
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!csv.trim()) {
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
      const data = await res.json();
      setMessage(data.message || data.error || (res.ok ? 'Update complete.' : 'Update failed.'));
      if (res.ok) {
        setCsv('');
        setInputKey((k) => k + 1);
      }
    } catch {
      setMessage('Update failed due to a network or server error.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card space-y-3" onSubmit={onSubmit}>
      <h2 className="text-xl font-bold">Upload Edited Active Roles CSV</h2>
      <p className="text-sm">
        Download <strong>Export active roles CSV</strong>, edit rows in place (match by <code>job_ref</code>), then upload to update roles.
      </p>
      <input
        key={inputKey}
        className="input"
        type="file"
        accept=".csv,text/csv"
        onChange={onFileChange}
      />
      <div className="flex gap-2">
        <button className="btn-primary" type="submit" disabled={!csv.trim() || submitting}>
          {submitting ? 'Updating...' : 'Upload and Update'}
        </button>
      </div>
      {message ? <p className="rounded-md bg-blue-100 p-3">{message}</p> : null}
    </form>
  );
}

