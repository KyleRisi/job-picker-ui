'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { LiveSearchInput } from '@/components/live-search-input';
import { trackMixpanel } from '@/lib/mixpanel-browser';
import type { FreakyCoveredEpisodeSuggestion, FreakyPublicSuggestion } from '@/lib/freaky';

type SuggestionBucket = 'open' | 'covered';

type SimilarSuggestion = FreakyPublicSuggestion & {
  isExact?: boolean;
  similarity?: number;
};

type FreakyTopicOption = {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
};

function formatRelativeTime(value: string): string {
  const ms = new Date(value).getTime();
  if (!Number.isFinite(ms)) return 'Unknown date';
  const diff = Date.now() - ms;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return 'Just now';
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  if (diff < day * 7) return `${Math.floor(diff / day)}d ago`;

  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatCoveredDate(value: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

const PAGE_SIZE = 20;
const STORAGE_BUCKET_KEY = 'freaky_register_selected_bucket';
const STORAGE_VOTED_KEY = 'freaky_register_voted_ids';

export function FreakyRegisterPage({
  initialSuggestions,
  initialHasMore
}: {
  initialSuggestions: FreakyPublicSuggestion[];
  initialHasMore: boolean;
}) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [bucket, setBucket] = useState<SuggestionBucket>(() => {
    if (typeof window === 'undefined') return 'open';
    const fromUrl = new URLSearchParams(window.location.search).get('bucket');
    if (fromUrl === 'covered' || fromUrl === 'open') return fromUrl;
    const saved = window.localStorage.getItem(STORAGE_BUCKET_KEY);
    return saved === 'covered' ? 'covered' : 'open';
  });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openSuggestions, setOpenSuggestions] = useState<FreakyPublicSuggestion[]>(initialSuggestions);
  const [coveredSuggestions, setCoveredSuggestions] = useState<FreakyCoveredEpisodeSuggestion[]>([]);
  const [hasMoreOpen, setHasMoreOpen] = useState(initialHasMore);
  const [hasMoreCovered, setHasMoreCovered] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitterFullName, setSubmitterFullName] = useState('');
  const [submitterCountry, setSubmitterCountry] = useState('');
  const [topicTermId, setTopicTermId] = useState('');
  const [email, setEmail] = useState('');
  const [showEmailStep, setShowEmailStep] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitMessage, setSubmitMessage] = useState('');
  const [duplicateHints, setDuplicateHints] = useState<SimilarSuggestion[]>([]);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [topicOptions, setTopicOptions] = useState<FreakyTopicOption[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(false);

  const [upvoteBusyId, setUpvoteBusyId] = useState<string | null>(null);
  const [upvotePromptId, setUpvotePromptId] = useState<string | null>(null);
  const [upvoteEmail, setUpvoteEmail] = useState('');
  const [upvoteMessage, setUpvoteMessage] = useState('');
  const [votedSuggestionIds, setVotedSuggestionIds] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_VOTED_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item) => typeof item === 'string');
    } catch {
      return [];
    }
  });

  const [resendBusy, setResendBusy] = useState(false);
  const [resendMessage, setResendMessage] = useState('');
  const effectiveSort = bucket === 'covered' ? 'newest' : 'top';
  const visibleOpenSuggestions = useMemo(
    () => openSuggestions.filter((item) => !item.isCovered && !item.coveredEpisode),
    [openSuggestions]
  );
  const hasMoreForBucket = bucket === 'covered' ? hasMoreCovered : hasMoreOpen;

  const verifyState = searchParams.get('verify') || '';
  const verifyRequestId = searchParams.get('request') || '';
  const highlightedSuggestionId = searchParams.get('suggestion') || '';

  const verifyBanner = useMemo(() => {
    if (verifyState === 'suggestion_success') {
      return {
        tone: 'success' as const,
        text: 'Suggestion verified and published. It is now live on the Freaky Register.'
      };
    }
    if (verifyState === 'vote_success') {
      return {
        tone: 'success' as const,
        text: 'Vote verified and recorded. This topic just got your backing.'
      };
    }
    if (verifyState === 'expired') {
      return {
        tone: 'warning' as const,
        text: 'That verification link has expired. You can request a fresh link below.'
      };
    }
    if (verifyState === 'invalid') {
      return {
        tone: 'warning' as const,
        text: 'That verification link is invalid or already used. Request a fresh link if needed.'
      };
    }
    if (verifyState === 'blocked') {
      return {
        tone: 'error' as const,
        text: 'This identity is blocked from Freaky Register actions.'
      };
    }
    return null;
  }, [verifyState]);

  useEffect(() => {
    trackMixpanel('Freaky Register Viewed', {
      path: '/freaky-register'
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setTopicsLoading(true);

    void (async () => {
      try {
        const response = await fetch('/api/freaky-register/topics');
        const data = await response.json().catch(() => ({}));
        if (!cancelled && response.ok && Array.isArray(data.items)) {
          setTopicOptions(data.items as FreakyTopicOption[]);
        }
      } finally {
        if (!cancelled) setTopicsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (verifyState === 'suggestion_success') {
      trackMixpanel('Suggestion Verified', { source: 'freaky_register', purpose: 'publish_suggestion' });
      trackMixpanel('Suggestion Published', { source: 'freaky_register', suggestionId: highlightedSuggestionId || undefined });
    } else if (verifyState === 'vote_success') {
      trackMixpanel('Suggestion Verified', { source: 'freaky_register', purpose: 'cast_vote' });
      if (highlightedSuggestionId) {
        setVotedSuggestionIds((current) => (
          current.includes(highlightedSuggestionId) ? current : [...current, highlightedSuggestionId]
        ));
      }
    }
  }, [highlightedSuggestionId, verifyState]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_BUCKET_KEY, bucket);
    const nextParams = new URLSearchParams(window.location.search);
    nextParams.set('bucket', bucket);
    const next = `${window.location.pathname}?${nextParams.toString()}${window.location.hash || ''}`;
    window.history.replaceState({}, '', next);
  }, [bucket]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_VOTED_KEY, JSON.stringify(votedSuggestionIds));
  }, [votedSuggestionIds]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('query', query.trim());
        params.set('sort', effectiveSort);
        params.set('bucket', bucket);
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', '0');
        const response = await fetch(`/api/freaky-register/suggestions?${params.toString()}`);
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          setOpenSuggestions(Array.isArray(data.openItems) ? (data.openItems as FreakyPublicSuggestion[]) : []);
          setCoveredSuggestions(Array.isArray(data.coveredItems) ? (data.coveredItems as FreakyCoveredEpisodeSuggestion[]) : []);
          setHasMoreOpen(Boolean(data.hasMoreOpen));
          setHasMoreCovered(Boolean(data.hasMoreCovered));
          if (query.trim()) {
            const resultCount = Array.isArray(data.items) ? data.items.length : 0;
            trackMixpanel('Suggestion Search Performed', {
              source: 'freaky_register',
              query: query.trim(),
              resultCount,
              sort: effectiveSort,
              bucket
            });
          }
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [bucket, query, effectiveSort]);

  async function loadMoreSuggestions() {
    if (loadingMore || loading || !hasMoreForBucket) return;
    setLoadingMore(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('query', query.trim());
      params.set('sort', effectiveSort);
      params.set('bucket', bucket);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(bucket === 'covered' ? coveredSuggestions.length : openSuggestions.length));
      const response = await fetch(`/api/freaky-register/suggestions?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        if (bucket === 'covered') {
          const next = Array.isArray(data.coveredItems) ? (data.coveredItems as FreakyCoveredEpisodeSuggestion[]) : [];
          setCoveredSuggestions((current) => [...current, ...next]);
          setHasMoreCovered(Boolean(data.hasMoreCovered));
        } else {
          const next = Array.isArray(data.openItems) ? (data.openItems as FreakyPublicSuggestion[]) : [];
          setOpenSuggestions((current) => [...current, ...next]);
          setHasMoreOpen(Boolean(data.hasMoreOpen));
        }
      }
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    const normalized = title.trim();
    if (normalized.length < 3) {
      setDuplicateHints([]);
      return;
    }

    const timer = setTimeout(async () => {
      const params = new URLSearchParams();
      params.set('title', normalized);
      params.set('limit', '5');
      const response = await fetch(`/api/freaky-register/suggestions/similar?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (response.ok && Array.isArray(data.items)) {
        setDuplicateHints(data.items as SimilarSuggestion[]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [title]);

  async function submitSuggestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError('');
    setSubmitMessage('');

    if (!showEmailStep) {
      setShowEmailStep(true);
      trackMixpanel('Suggestion Submit Started', { source: 'freaky_register' });
      return;
    }

    setSubmitBusy(true);
    try {
      const response = await fetch('/api/freaky-register/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: submitterFullName,
          country: submitterCountry,
          topicTermId,
          title,
          description,
          email,
          website: ''
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSubmitError(data?.error || 'Unable to submit your suggestion.');
        return;
      }

      setSubmitMessage(
        data?.message || 'You’re one step away — we’ve sent you an email. Click the link to confirm your suggestion.'
      );
      setDuplicateHints(Array.isArray(data?.duplicates) ? (data.duplicates as SimilarSuggestion[]) : []);
      setSubmitterFullName('');
      setSubmitterCountry('');
      setTopicTermId('');
      setTitle('');
      setDescription('');
      setEmail('');
      setShowEmailStep(false);

      trackMixpanel('Suggestion Submit Requested', { source: 'freaky_register', suggestionId: data?.suggestionId });
      trackMixpanel('Suggestion Verification Sent', {
        source: 'freaky_register',
        purpose: 'publish_suggestion',
        requestId: data?.requestId
      });
    } finally {
      setSubmitBusy(false);
    }
  }

  async function triggerUpvote(suggestionId: string, emailForVote?: string) {
    if (votedSuggestionIds.includes(suggestionId)) return;
    setUpvoteBusyId(suggestionId);
    setUpvoteMessage('');
    try {
      const response = await fetch('/api/freaky-register/votes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestionId,
          email: emailForVote || undefined,
          website: ''
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setUpvoteMessage(data?.error || 'Could not process upvote.');
        return;
      }

      if (data?.verificationRequired) {
        if (data?.needsEmail) {
          setUpvotePromptId(suggestionId);
          return;
        }
        setUpvoteMessage(data?.message || 'Verification email sent.');
        trackMixpanel('Suggestion Verification Sent', {
          source: 'freaky_register',
          purpose: 'cast_vote',
          requestId: data?.requestId,
          suggestionId
        });
        return;
      }

      setOpenSuggestions((current) => current.map((item) => {
        if (item.id !== suggestionId) return item;
        const count = typeof data?.upvoteCount === 'number' ? data.upvoteCount : item.upvoteCount;
        return { ...item, upvoteCount: count };
      }));

      if (data?.alreadyBacked) {
        setVotedSuggestionIds((current) => current.includes(suggestionId) ? current : [...current, suggestionId]);
      } else {
        setVotedSuggestionIds((current) => current.includes(suggestionId) ? current : [...current, suggestionId]);
        trackMixpanel('Suggestion Upvoted', { source: 'freaky_register', suggestionId });
      }
      setUpvotePromptId(null);
      setUpvoteEmail('');
    } finally {
      setUpvoteBusyId(null);
    }
  }

  async function resendVerification() {
    if (!verifyRequestId || resendBusy) return;
    setResendBusy(true);
    setResendMessage('');
    try {
      const response = await fetch('/api/freaky-register/verification/resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: verifyRequestId, website: '' })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setResendMessage(data?.error || 'Unable to resend verification link.');
        return;
      }
      setResendMessage(data?.message || 'Verification email resent.');
      trackMixpanel('Suggestion Verification Sent', {
        source: 'freaky_register',
        requestId: data?.requestId,
        resend: true
      });
    } finally {
      setResendBusy(false);
    }
  }

  const formControlClassName = 'w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-carnival-gold focus:outline-none focus:ring-2 focus:ring-carnival-gold/30';
  const formSelectClassName = 'w-full rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white focus:border-carnival-gold focus:outline-none focus:ring-2 focus:ring-carnival-gold/30';
  const hasAnyResults = bucket === 'covered' ? coveredSuggestions.length > 0 : visibleOpenSuggestions.length > 0;

  function renderOpenSuggestionCard(item: FreakyPublicSuggestion) {
    const highlighted = item.id === highlightedSuggestionId;
    const isPromptOpen = upvotePromptId === item.id;
    const hasVoted = votedSuggestionIds.includes(item.id);
    return (
      <li
        key={item.id}
        id={`suggestion-${item.id}`}
        className={[
          'rounded-2xl border bg-white/10 p-4 shadow-card backdrop-blur-sm sm:p-5',
          highlighted ? 'border-carnival-gold ring-2 ring-carnival-gold/35' : 'border-white/15'
        ].join(' ')}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            {item.topicName ? (
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-carnival-gold">{item.topicName}</p>
            ) : null}
            <h2 className="text-lg font-black text-white sm:text-xl">{item.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-white/85">{item.description}</p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-white/60">
              {formatRelativeTime(item.createdAt)}
            </p>
            {isPromptOpen && (
              <form
                className="mt-3 flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  void triggerUpvote(item.id, upvoteEmail);
                }}
              >
                <input
                  type="email"
                  required
                  value={upvoteEmail}
                  onChange={(event) => setUpvoteEmail(event.target.value)}
                  placeholder="Email for upvote verification"
                  className="w-full rounded-lg border border-white/30 bg-carnival-cream px-3 py-2 text-sm text-carnival-ink focus:border-carnival-gold focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="inline-flex items-center rounded-full bg-carnival-red px-4 py-2 text-xs font-black uppercase tracking-wide text-white"
                  >
                    Send link
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpvotePromptId(null)}
                    className="inline-flex items-center rounded-full border border-white/30 px-4 py-2 text-xs font-black uppercase tracking-wide text-white"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-white/15 pt-3 sm:border-0 sm:pt-0 sm:flex-col sm:items-center sm:justify-center sm:gap-2 sm:px-4">
            <p className="text-left text-xs font-black uppercase tracking-wide text-white sm:text-center">
              <span className="block text-2xl leading-none">{item.upvoteCount}</span>
              <span className="block text-[11px] text-white/80">{item.upvoteCount === 1 ? 'Vote' : 'Votes'}</span>
            </p>
            <button
              type="button"
              onClick={() => void triggerUpvote(item.id)}
              disabled={upvoteBusyId === item.id || hasVoted}
              className={[
                'inline-flex items-center rounded-full px-6 py-2 text-xs font-black uppercase tracking-wide text-white transition disabled:opacity-65',
                hasVoted ? 'bg-emerald-600' : 'bg-carnival-red hover:brightness-110'
              ].join(' ')}
            >
              {hasVoted ? 'Voted' : 'Vote'}
            </button>
          </div>
        </div>
      </li>
    );
  }

  function renderCoveredEpisodeCard(item: FreakyCoveredEpisodeSuggestion) {
    return (
      <li
        key={item.coveredEpisode.id}
        className="rounded-2xl border border-white/15 bg-white/10 p-4 shadow-card backdrop-blur-sm sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="border-b border-white/15 pb-3 sm:border-b-0 sm:pb-0">
              {(item.coveredEpisode.publishedAt || item.coveredAt) ? (
                <p className="text-right text-xs font-semibold uppercase tracking-wide text-white/60 sm:text-left">
                  Covered {formatCoveredDate(item.coveredEpisode.publishedAt || item.coveredAt || '')}
                </p>
              ) : null}
              <div className="mt-2 flex items-center gap-3">
                {item.coveredEpisode.artworkUrl ? (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/20 bg-white/5 sm:hidden">
                    <Image
                      src={item.coveredEpisode.artworkUrl}
                      alt={`Artwork for ${item.coveredEpisode.title}`}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                ) : null}
                <h2 className="text-lg font-black text-white sm:text-xl">{item.coveredEpisode.title}</h2>
              </div>
            </div>
            <div className="mt-4 sm:mt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-carnival-gold">Suggested by</p>
              <ul className="mt-2 space-y-1 text-sm text-white/85">
                {item.linkedContributors.map((contributor, index) => (
                  <li key={`${item.coveredEpisode.id}-${contributor.fullName}-${contributor.country}-${index}`}>
                    {contributor.fullName} - {contributor.country}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-white/15 pt-3 sm:min-w-[124px] sm:border-0 sm:pt-0 sm:flex-col sm:items-center sm:justify-start sm:gap-3 sm:px-2">
            {item.coveredEpisode.artworkUrl ? (
              <div className="relative hidden h-20 w-20 overflow-hidden rounded-lg border border-white/20 bg-white/5 sm:block">
                <Image
                  src={item.coveredEpisode.artworkUrl}
                  alt={`Artwork for ${item.coveredEpisode.title}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
            ) : (
              <span className="inline-flex h-20 w-20 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-[10px] font-bold uppercase tracking-wide text-white/65">
                No art
              </span>
            )}
            <div className="flex w-full items-center justify-between sm:w-full sm:flex-col sm:items-center sm:gap-2">
              <p className="hidden text-center text-xs font-black uppercase tracking-wide text-white/80 sm:block">
                <span className="block text-2xl leading-none text-white">{item.totalVotes}</span>
                <span className="block text-[11px] text-white/80">{item.totalVotes === 1 ? 'Vote' : 'Votes'}</span>
              </p>
              <Link
                href={`/episodes/${item.coveredEpisode.slug}`}
                className="inline-flex items-center rounded-full border border-white/35 px-6 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-white/10"
              >
                Listen
              </Link>
              <p className="text-right text-xs font-black uppercase tracking-wide text-white/80 sm:hidden">
                <span className="text-sm text-white">{item.totalVotes}</span> {item.totalVotes === 1 ? 'Vote' : 'Votes'}
              </p>
            </div>
          </div>
        </div>
      </li>
    );
  }

  return (
    <>
      <section className="full-bleed relative -mt-8 overflow-hidden bg-carnival-ink py-14 md:py-20">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <Image
          src="/cover-banner-hero.jpg"
          alt=""
          fill
          priority
          quality={72}
          className="object-cover object-top opacity-30"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-carnival-ink/70 via-carnival-ink/85 to-carnival-ink" />
        <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-carnival-red/25 blur-[120px]" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-carnival-gold/20 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl space-y-8 px-4">
        <header className="space-y-3 text-center">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-carnival-gold">The Compendium Podcast</p>
          <h1 className="text-4xl font-black text-white sm:text-5xl">Freaky Register</h1>
          <p className="mx-auto max-w-3xl text-sm leading-relaxed text-white/80 sm:text-base">
            Got a cursed case, bizarre mystery, historical disaster, scandal, cult, or other deeply suspicious little
            tale we should cover? Submit it here, or back an existing suggestion.
          </p>
        </header>

        {verifyBanner ? (
          <div
            className={[
              'rounded-2xl border bg-white/10 px-4 py-3 text-sm font-semibold backdrop-blur-sm',
              verifyBanner.tone === 'success' ? 'border-emerald-300/50 text-emerald-100' : '',
              verifyBanner.tone === 'warning' ? 'border-amber-300/50 text-amber-100' : '',
              verifyBanner.tone === 'error' ? 'border-rose-300/50 text-rose-100' : ''
            ].join(' ')}
          >
            <p>{verifyBanner.text}</p>
            {(verifyState === 'expired' || verifyState === 'invalid') && verifyRequestId ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={resendVerification}
                  disabled={resendBusy}
                  className="inline-flex items-center rounded-full bg-carnival-red px-4 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:brightness-110 disabled:opacity-60"
                >
                  {resendBusy ? 'Resending...' : 'Resend verification'}
                </button>
                {resendMessage ? <p className="text-xs font-semibold text-white/90">{resendMessage}</p> : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <section className="rounded-2xl border border-white/15 bg-white/10 p-5 shadow-card backdrop-blur-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-black text-white sm:text-xl">Have a topic suggestion?</h2>
            <button
              type="button"
              onClick={() => setShowSubmitForm((current) => !current)}
              aria-expanded={showSubmitForm}
              aria-controls="freaky-submit-form"
              className="inline-flex items-center justify-center rounded-full bg-carnival-red px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
            >
              {showSubmitForm ? 'Hide submission form' : '+ Suggest an Episode'}
            </button>
          </div>

          {showSubmitForm ? (
            <form id="freaky-submit-form" onSubmit={submitSuggestion} className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="freaky-full-name" className="mb-1 block text-sm font-bold text-white">
                  Full name <span className="text-carnival-gold">*</span>
                </label>
                <input
                  id="freaky-full-name"
                  required
                  value={submitterFullName}
                  onChange={(event) => setSubmitterFullName(event.target.value)}
                  maxLength={120}
                  className={formControlClassName}
                  placeholder="Your full name"
                />
              </div>
              <div>
                <label htmlFor="freaky-country" className="mb-1 block text-sm font-bold text-white">
                  Where are you from? <span className="text-carnival-gold">*</span>
                </label>
                <input
                  id="freaky-country"
                  required
                  value={submitterCountry}
                  onChange={(event) => setSubmitterCountry(event.target.value)}
                  maxLength={80}
                  className={formControlClassName}
                  placeholder="Country or region"
                />
              </div>
              <div>
                <label htmlFor="freaky-topic" className="mb-1 block text-sm font-bold text-white">
                  Topic type <span className="text-carnival-gold">*</span>
                </label>
                <select
                  id="freaky-topic"
                  required
                  value={topicTermId}
                  onChange={(event) => setTopicTermId(event.target.value)}
                  className={formSelectClassName}
                >
                  <option value="">{topicsLoading ? 'Loading active topics...' : 'Select an active Topic'}</option>
                  {topicOptions.map((topic) => (
                    <option key={topic.id} value={topic.id}>
                      {topic.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="freaky-title" className="mb-1 block text-sm font-bold text-white">
                  Topic title <span className="text-carnival-gold">*</span>
                </label>
                <input
                  id="freaky-title"
                  required
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={140}
                  className={formControlClassName}
                  placeholder="What should we investigate?"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="freaky-description" className="mb-1 block text-sm font-bold text-white">
                  Short description <span className="text-carnival-gold">*</span>
                </label>
                <textarea
                  id="freaky-description"
                  required
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={500}
                  rows={4}
                  className={formControlClassName}
                  placeholder="Give us the strange-but-essential context in 500 characters or less."
                />
                <p className="mt-1 text-xs text-white/70">{description.length}/500</p>
              </div>

              {showEmailStep ? (
                <div className="sm:col-span-2">
                  <label htmlFor="freaky-email" className="mb-1 block text-sm font-bold text-white">
                    Email for verification <span className="text-carnival-gold">*</span>
                  </label>
                  <input
                    id="freaky-email"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={formControlClassName}
                    placeholder="you@example.com"
                  />
                  <p className="mt-1 text-xs text-white/70">No password, no account wall. Just one verification link.</p>
                </div>
              ) : null}

              <div className="hidden" aria-hidden="true">
                <label htmlFor="freaky-website">Website</label>
                <input id="freaky-website" name="website" tabIndex={-1} autoComplete="off" />
              </div>
            </div>

            {duplicateHints.length ? (
              <div className="rounded-xl border border-carnival-gold/35 bg-carnival-gold/10 p-3 text-sm text-white/95">
                <p className="font-bold">Already suggested? Consider backing one of these:</p>
                <ul className="mt-2 space-y-1">
                  {duplicateHints.map((item) => (
                    <li key={item.id}>
                      <a href={`#suggestion-${item.id}`} className="font-semibold text-carnival-gold underline underline-offset-2">
                        {item.title}
                      </a>
                      <span className="ml-2 text-xs text-white/75">({item.upvoteCount} votes)</span>
                      {item.isExact ? <span className="ml-2 rounded-full bg-carnival-red/25 px-2 py-0.5 text-[10px] font-bold uppercase text-carnival-gold">Exact match</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {submitError ? <p className="rounded-lg border border-rose-300/60 bg-rose-900/25 px-3 py-2 text-sm font-semibold text-rose-100">{submitError}</p> : null}
            {submitMessage ? <p className="rounded-lg border border-emerald-300/60 bg-emerald-900/25 px-3 py-2 text-sm font-semibold text-emerald-100">{submitMessage}</p> : null}

            <button
              type="submit"
              disabled={submitBusy}
              className="inline-flex items-center justify-center rounded-full bg-carnival-red px-6 py-3 text-xs font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitBusy ? 'Submitting...' : showEmailStep ? 'Submit and send verification link' : 'Continue'}
            </button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-white/80">
              Browse what listeners have already suggested, then open the form when you are ready to add one.
            </p>
          )}
        </section>

        <section className="space-y-4">
          <div className="space-y-3 rounded-2xl border border-white/15 bg-white/10 p-4 shadow-card backdrop-blur-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <LiveSearchInput
                id="freaky-search"
                value={query}
                onChange={setQuery}
                placeholder="Search title or description"
                ariaLabel="Search suggestions"
                className="w-full sm:max-w-[760px] sm:flex-1"
                inputClassName={formControlClassName}
              />
            </div>
          </div>

          {upvoteMessage ? (
            <p className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white">{upvoteMessage}</p>
          ) : null}

          {loading ? <p className="text-sm font-semibold text-white/70">Loading suggestions...</p> : null}

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={bucket === 'open'}
              onClick={() => setBucket('open')}
              className={[
                'inline-flex h-9 items-center justify-center rounded-full px-4 text-xs font-black uppercase tracking-wide transition',
                bucket === 'open'
                  ? 'bg-carnival-red text-white'
                  : 'border border-white/20 bg-white/10 text-white/80 hover:bg-white/15'
              ].join(' ')}
            >
              Suggestions
            </button>
            <button
              type="button"
              aria-pressed={bucket === 'covered'}
              onClick={() => setBucket('covered')}
              className={[
                'inline-flex h-9 items-center justify-center rounded-full px-4 text-xs font-black uppercase tracking-wide transition',
                bucket === 'covered'
                  ? 'bg-carnival-red text-white'
                  : 'border border-white/20 bg-white/10 text-white/80 hover:bg-white/15'
              ].join(' ')}
            >
              Covered
            </button>
          </div>

          {!loading && !hasAnyResults && !query.trim() ? (
            <div className="rounded-2xl border border-white/15 bg-white/10 p-6 text-sm text-white/80 shadow-card backdrop-blur-sm">
              {bucket === 'covered'
                ? 'No covered episodes yet.'
                : 'No open suggestions yet. Be the first to add one.'}
            </div>
          ) : null}

          {!loading && !hasAnyResults && query.trim() ? (
            <div className="rounded-2xl border border-white/15 bg-white/10 p-6 text-sm text-white/80 shadow-card backdrop-blur-sm">
              No matches found for “{query.trim()}”. Try a different phrase.
            </div>
          ) : null}

          <ul className="space-y-3">
            {bucket === 'open'
              ? visibleOpenSuggestions.map((item) => renderOpenSuggestionCard(item))
              : coveredSuggestions.map((item) => renderCoveredEpisodeCard(item))}
          </ul>

          {!loading && (bucket === 'covered' ? coveredSuggestions.length > 0 : visibleOpenSuggestions.length > 0) && hasMoreForBucket ? (
            <div className="flex justify-center pt-1">
              <button
                type="button"
                onClick={() => void loadMoreSuggestions()}
                disabled={loadingMore}
                className="inline-flex items-center justify-center rounded-full bg-carnival-red px-6 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loadingMore ? 'Loading...' : 'Load more'}
              </button>
            </div>
          ) : null}
        </section>
      </div>
      </section>

      <section className="full-bleed -mb-8 bg-carnival-gold py-16 md:py-24">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-10 px-4 text-center">
          <div>
            <span className="inline-block rounded-full bg-carnival-teal px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white">
              The Compendium Podcast
            </span>
            <h2 className="mt-3 text-4xl font-black tracking-tight text-carnival-ink md:text-5xl">
              Join the Team
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-carnival-ink/85">
              Ready to enter the official administrative chaos pipeline? Pick a role, submit your
              application, and claim your place in circus history.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                href="/jobs"
                className="inline-flex items-center gap-2 rounded-full bg-carnival-red px-7 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
              >
                Find a Job &rarr;
              </Link>
              <Link
                href="/my-job"
                className="inline-flex items-center gap-2 rounded-full border-2 border-carnival-teal bg-carnival-teal px-7 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
              >
                I Have a Job
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
