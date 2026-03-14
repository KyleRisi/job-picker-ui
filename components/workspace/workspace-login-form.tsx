'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

type LoginState = {
  message: string;
  error: string;
};

export function WorkspaceLoginForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<LoginState>({ message: '', error: '' });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setState({ message: '', error: '' });

    const payload = Object.fromEntries(new FormData(event.currentTarget).entries());

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setState({
          message: '',
          error: data?.message || data?.error || 'Unable to sign in. Check your credentials and try again.'
        });
        setLoading(false);
        return;
      }

      setState({ message: 'Signed in. Redirecting to workspace...', error: '' });
      router.replace('/workspace/dashboard/episodes');
      router.refresh();
    } catch {
      setState({ message: '', error: 'Network error. Please try again.' });
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-lg border border-slate-300 bg-white p-6 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold text-slate-900">Sign in</h2>
        <p className="text-sm text-slate-600">Use your admin credentials to access the workspace.</p>
      </div>

      <div className="space-y-4">
        <label className="block text-sm font-medium text-slate-700" htmlFor="workspace-admin-email">
          Admin email
          <input
            id="workspace-admin-email"
            name="email"
            type="email"
            required
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </label>

        <label className="block text-sm font-medium text-slate-700" htmlFor="workspace-admin-password">
          Password
          <input
            id="workspace-admin-password"
            name="password"
            type="password"
            required
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>

      {state.error ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      ) : null}
      {state.message ? (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p>
      ) : null}
    </form>
  );
}
