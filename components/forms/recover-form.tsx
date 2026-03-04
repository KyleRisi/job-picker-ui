'use client';

import { FormEvent, useState } from 'react';

export function RecoverForm() {
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const res = await fetch('/api/my-job/recover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(formData.entries()))
    });
    const data = await res.json();
    setMsg(data.message || data.error || 'Done');
    setLoading(false);
  }

  return (
    <form className="card space-y-4" onSubmit={onSubmit}>
      <div>
        <label className="label" htmlFor="recover-email">Email</label>
        <input className="input" id="recover-email" name="email" type="email" required />
      </div>
      <button className="btn-primary" disabled={loading} type="submit">
        {loading ? 'Sending...' : 'Recover my reference'}
      </button>
      {msg ? <p className="rounded-md bg-blue-100 p-3">{msg}</p> : null}
    </form>
  );
}
