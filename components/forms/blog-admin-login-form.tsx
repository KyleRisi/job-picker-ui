'use client';

import { FormEvent, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase-browser';

export function BlogAdminLoginForm({ adminEmail }: { adminEmail: string }) {
  const [email, setEmail] = useState(adminEmail);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    const supabase = createSupabaseBrowserClient();
    const normalized = email.trim().toLowerCase();
    if (!normalized || normalized !== adminEmail.toLowerCase()) {
      setMessage('Use the configured admin email for blog access.');
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email: normalized,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm?admin=1&next=/admin/blog`
      }
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
      return;
    }
    setMessage('Check your email for the Supabase magic link.');
    setLoading(false);
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-3">
      <h2 className="text-xl font-bold">Blog CMS sign-in</h2>
      <p className="text-sm text-carnival-ink/75">
        The blog CMS uses Supabase Auth. Send a magic link to the configured admin email.
      </p>
      <label className="label" htmlFor="blog-admin-email">Admin email</label>
      <input
        className="input"
        id="blog-admin-email"
        name="email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.currentTarget.value)}
      />
      <button className="btn-secondary" type="submit" disabled={loading}>
        {loading ? 'Sending magic link…' : 'Send Supabase magic link'}
      </button>
      {message ? <p className="rounded-md bg-blue-100 p-3 text-sm">{message}</p> : null}
    </form>
  );
}
