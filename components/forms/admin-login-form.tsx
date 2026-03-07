'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { identifyMixpanel, trackMixpanel } from '@/lib/mixpanel-browser';

export function AdminLoginForm() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const body = Object.fromEntries(new FormData(e.currentTarget).entries());
    const normalizedEmail = `${body.email || ''}`.trim().toLowerCase();
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (res.ok) {
      trackMixpanel('Sign In', {
        user_id: normalizedEmail,
        login_method: 'email_password',
        success: true
      });
      identifyMixpanel(normalizedEmail, {
        $email: normalizedEmail
      });
      setMessage('Signed in. Redirecting…');
      router.push('/admin');
      router.refresh();
      return;
    }
    trackMixpanel('Sign In', {
      user_id: normalizedEmail,
      login_method: 'email_password',
      success: false
    });
    setMessage(data.message || data.error || 'Done');
    setLoading(false);
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="text-xl font-bold">Admin sign-in</h2>
      <label className="label" htmlFor="admin-email">Admin email</label>
      <input className="input" id="admin-email" name="email" type="email" required />
      <label className="label" htmlFor="admin-password">Password</label>
      <input className="input" id="admin-password" name="password" type="password" required />
      <button className="btn-primary" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
      {message ? <p className="rounded-md bg-blue-100 p-3">{message}</p> : null}
    </form>
  );
}
