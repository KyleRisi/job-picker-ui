'use client';

import { FormEvent, useState } from 'react';

type ContactReason = 'general' | 'guest' | 'press' | 'sponsorship' | 'other';

const REASONS: Array<{ value: ContactReason; label: string }> = [
  { value: 'general', label: 'General enquiry' },
  { value: 'guest', label: 'Guest request' },
  { value: 'press', label: 'Press / media' },
  { value: 'sponsorship', label: 'Sponsorship / partnership' },
  { value: 'other', label: 'Other' }
];

export function ConnectForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState<ContactReason>('general');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess(false);

    if (!name.trim() || name.trim().length < 2) {
      setError('Please provide your name.');
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please provide a valid email address.');
      return;
    }
    if (!subject.trim() || subject.trim().length < 2) {
      setError('Please add a subject.');
      return;
    }
    if (!message.trim() || message.trim().length < 10) {
      setError('Please include at least a short message.');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/contact/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          reason,
          subject,
          message,
          website
        })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Unable to send your message right now.');
      }

      setName('');
      setEmail('');
      setReason('general');
      setSubject('');
      setMessage('');
      setWebsite('');
      setSuccess(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong while sending your message.');
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-carnival-gold/30 bg-carnival-gold/10 p-8 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-carnival-gold/30">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-white" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-black text-white">Thanks for reaching out!</h3>
        <p className="mt-2 text-sm text-white/70">
          Your message has been sent to the team. We&apos;ll get back to you as soon as we can.
        </p>
        <button
          type="button"
          onClick={() => setSuccess(false)}
          className="mt-4 text-sm font-bold text-carnival-gold underline underline-offset-2 hover:no-underline"
        >
          Submit another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-white/15 bg-white/10 p-5 shadow-card backdrop-blur-sm sm:p-6">
      <div>
        <h2 className="text-2xl font-black text-white">Send us a message</h2>
        <p className="mt-1 text-sm text-white/65">Questions, ideas, collaborations, press, or anything else.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="connect-name" className="mb-1 block text-sm font-bold text-white">
            Name <span className="text-carnival-gold">*</span>
          </label>
          <input
            id="connect-name"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-carnival-gold focus:outline-none focus:ring-2 focus:ring-carnival-gold/30"
            placeholder="Your name"
          />
        </div>
        <div>
          <label htmlFor="connect-email" className="mb-1 block text-sm font-bold text-white">
            Email <span className="text-carnival-gold">*</span>
          </label>
          <input
            id="connect-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-carnival-gold focus:outline-none focus:ring-2 focus:ring-carnival-gold/30"
            placeholder="you@email.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="connect-reason" className="mb-1 block text-sm font-bold text-white">Reason</label>
        <select
          id="connect-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value as ContactReason)}
          className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white focus:border-carnival-gold focus:outline-none focus:ring-2 focus:ring-carnival-gold/30"
        >
          {REASONS.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="connect-subject" className="mb-1 block text-sm font-bold text-white">
          Subject <span className="text-carnival-gold">*</span>
        </label>
        <input
          id="connect-subject"
          type="text"
          required
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-carnival-gold focus:outline-none focus:ring-2 focus:ring-carnival-gold/30"
          placeholder="What’s this about?"
        />
      </div>

      <div>
        <label htmlFor="connect-message" className="mb-1 block text-sm font-bold text-white">
          Message <span className="text-carnival-gold">*</span>
        </label>
        <textarea
          id="connect-message"
          required
          rows={6}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-carnival-gold focus:outline-none focus:ring-2 focus:ring-carnival-gold/30"
          placeholder="Tell us what you need..."
        />
      </div>

      <div className="hidden" aria-hidden="true">
        <label htmlFor="connect-website">Website</label>
        <input
          id="connect-website"
          type="text"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          autoComplete="off"
          tabIndex={-1}
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-carnival-red/30 bg-carnival-red/10 px-3 py-2 text-sm font-semibold text-carnival-red">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-full bg-carnival-red px-7 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
}
