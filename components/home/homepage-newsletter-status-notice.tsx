'use client';

import { useEffect, useState } from 'react';

type NewsletterTone = 'success' | 'error';

type NewsletterMessage = {
  tone: NewsletterTone;
  text: string;
};

function newsletterMessage(status: string): NewsletterMessage | null {
  if (status === 'success') {
    return {
      tone: 'success',
      text: 'You are on the list. Weekly episode alerts are now heading your way.'
    };
  }

  if (status === 'duplicate') {
    return {
      tone: 'success',
      text: 'You are already subscribed with that email address.'
    };
  }

  if (status === 'rate_limited') {
    return {
      tone: 'error',
      text: 'Too many signup attempts right now. Please wait and try again shortly.'
    };
  }

  if (status === 'invalid' || status === 'error') {
    return {
      tone: 'error',
      text: 'Please enter a valid email address and try again.'
    };
  }

  return null;
}

function readNewsletterStatusFromLocation(): NewsletterMessage | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const status = `${params.get('newsletter') || ''}`.trim().toLowerCase();
  return newsletterMessage(status);
}

export function HomepageNewsletterStatusNotice() {
  const [message, setMessage] = useState<NewsletterMessage | null>(null);

  useEffect(() => {
    const sync = () => setMessage(readNewsletterStatusFromLocation());
    sync();
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  if (!message) return null;

  return (
    <p
      className={`mt-3 rounded-md px-3 py-2 text-sm font-medium ${
        message.tone === 'success'
          ? 'border border-emerald-300 bg-emerald-50 text-emerald-700'
          : 'border border-rose-300 bg-rose-50 text-rose-700'
      }`}
    >
      {message.text}
    </p>
  );
}
