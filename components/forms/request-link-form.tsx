'use client';

import { FormEvent, useState } from 'react';

export function RequestLinkForm() {
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRecover, setShowRecover] = useState(false);
  const [recoverMsg, setRecoverMsg] = useState('');
  const [recoverLoading, setRecoverLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    const formData = new FormData(e.currentTarget);
    const res = await fetch('/api/my-job/request-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });
    const data = await res.json();
    if (res.ok && data.redirectTo) {
      window.location.assign(data.redirectTo);
      return;
    }
    setMsg(data.message || data.error || 'Done');
    setLoading(false);
  }

  async function onRecoverSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRecoverLoading(true);
    setRecoverMsg('');
    const formData = new FormData(e.currentTarget);
    const res = await fetch('/api/my-job/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: formData.get('recoverEmail') })
    });
    const data = await res.json();
    setRecoverMsg(data.message || data.error || 'Done');
    setRecoverLoading(false);
  }

  return (
    <div className="space-y-4">
      <form className="card space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required />
        </div>
        <div>
          <label className="label" htmlFor="assignmentRef">Reference number</label>
          <input
            className="input italic placeholder:italic"
            id="assignmentRef"
            name="assignmentRef"
            placeholder="example: JOB-000"
            required
          />
        </div>
        <button className="btn-primary" disabled={loading} type="submit">
          {loading ? 'Checking...' : 'Lookup my Job Description'}
        </button>
        {msg ? <p className="rounded-md bg-blue-100 p-3">{msg}</p> : null}
      </form>
      <div className="card space-y-3">
        <button
          className="btn-secondary"
          type="button"
          onClick={() => {
            setShowRecover((prev) => !prev);
            setRecoverMsg('');
          }}
        >
          Forgot my job reference number
        </button>
        {showRecover ? (
          <form className="space-y-3" onSubmit={onRecoverSubmit}>
            <div>
              <label className="label" htmlFor="recoverEmail">Email address</label>
              <input className="input" id="recoverEmail" name="recoverEmail" type="email" required />
            </div>
            <button className="btn-primary" disabled={recoverLoading} type="submit">
              {recoverLoading ? 'Sending...' : 'Get my job reference number'}
            </button>
            {recoverMsg ? <p className="rounded-md bg-blue-100 p-3">{recoverMsg}</p> : null}
          </form>
        ) : null}
      </div>
    </div>
  );
}
