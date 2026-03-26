'use client';

import { useMemo, useState } from 'react';
import type {
  HomepageV2Content,
  HomepageV2CuratedCard,
  HomepageV2Pillar,
  HomepageV2ReviewQuote
} from '@/lib/homepage-v2/content';

type EpisodeOption = {
  slug: string;
  title: string;
  primaryTopicSlug: string;
};

function pillarLabelFromValue(pillar: HomepageV2Pillar): string {
  if (pillar === 'true_crime') return 'True Crime';
  if (pillar === 'history') return 'History';
  return 'Incredible People';
}

function normalizePillarFromEpisode(topicSlug: string): HomepageV2Pillar {
  if (topicSlug === 'history') return 'history';
  if (topicSlug === 'incredible-people') return 'incredible_people';
  return 'true_crime';
}

function createBlankCard(episodes: EpisodeOption[]): HomepageV2CuratedCard {
  const fallbackEpisode = episodes[0];
  const pillar = fallbackEpisode ? normalizePillarFromEpisode(fallbackEpisode.primaryTopicSlug) : 'true_crime';
  return {
    pillar,
    pillarLabel: pillarLabelFromValue(pillar),
    episodeSlug: fallbackEpisode?.slug || '',
    customBlurb: 'Add a concise payoff-led description for this episode card.'
  };
}

function createBlankReviewQuote(): HomepageV2ReviewQuote {
  return {
    quote: 'Great storytelling and consistently brilliant episodes.',
    author: 'Compendium listener',
    source: 'Apple Podcasts'
  };
}

export function WorkspaceHomepageV2Editor({
  initialContent,
  episodes,
  source
}: {
  initialContent: HomepageV2Content;
  episodes: EpisodeOption[];
  source: 'settings' | 'auto_seed';
}) {
  const [content, setContent] = useState<HomepageV2Content>(initialContent);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const episodeBySlug = useMemo(() => {
    return new Map(episodes.map((episode) => [episode.slug, episode]));
  }, [episodes]);

  function updateCard(
    collection: 'startHereCards' | 'popularCards',
    index: number,
    patch: Partial<HomepageV2CuratedCard>
  ) {
    setContent((previous) => {
      const nextCards = [...previous[collection]];
      const existing = nextCards[index];
      if (!existing) return previous;
      nextCards[index] = {
        ...existing,
        ...patch
      };
      return {
        ...previous,
        [collection]: nextCards
      };
    });
  }

  function updateReview(index: number, patch: Partial<HomepageV2ReviewQuote>) {
    setContent((previous) => {
      const next = [...previous.reviewQuotes];
      const existing = next[index];
      if (!existing) return previous;
      next[index] = { ...existing, ...patch };
      return { ...previous, reviewQuotes: next };
    });
  }

  function addPopularCard() {
    setContent((previous) => {
      if (previous.popularCards.length >= 6) return previous;
      return {
        ...previous,
        popularCards: [...previous.popularCards, createBlankCard(episodes)]
      };
    });
  }

  function removePopularCard(index: number) {
    setContent((previous) => {
      if (previous.popularCards.length <= 4) return previous;
      const next = previous.popularCards.filter((_, itemIndex) => itemIndex !== index);
      return {
        ...previous,
        popularCards: next
      };
    });
  }

  function handleEpisodeChange(collection: 'startHereCards' | 'popularCards', index: number, episodeSlug: string) {
    const episode = episodeBySlug.get(episodeSlug);
    const pillar = normalizePillarFromEpisode(episode?.primaryTopicSlug || 'true-crime');
    updateCard(collection, index, {
      episodeSlug,
      pillar,
      pillarLabel: pillarLabelFromValue(pillar)
    });
  }

  async function saveContent() {
    if (saving) return;
    setSaving(true);
    setNotice(null);
    setErrorNotice(null);

    try {
      const response = await fetch('/api/admin/homepage-v2-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content)
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorNotice(body?.error || 'Failed to save homepage content.');
        return;
      }

      if (body?.content) {
        setContent(body.content as HomepageV2Content);
      }

      setNotice('Homepage V2 content saved.');
    } catch {
      setErrorNotice('Network error while saving homepage content.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Homepage V2 Content</h1>
        <p className="text-sm text-slate-600">
          Edit curated homepage sections without hardcoding. Source: <strong>{source === 'settings' ? 'Saved settings' : 'Auto-seeded fallback'}</strong>.
        </p>
      </header>

      {notice ? (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</p>
      ) : null}
      {errorNotice ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorNotice}</p>
      ) : null}

      <div className="rounded-md border border-slate-300 bg-white p-4 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Hero Supporting Copy</h2>
        <textarea
          className="min-h-[88px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          value={content.heroSupportingCopy}
          onChange={(event) => setContent((previous) => ({ ...previous, heroSupportingCopy: event.currentTarget.value }))}
        />
      </div>

      <div className="rounded-md border border-slate-300 bg-white p-4 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Start Here Cards (3)</h2>
        <div className="space-y-4">
          {content.startHereCards.map((card, index) => (
            <article key={`start-${index}`} className="rounded-md border border-slate-200 p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Card {index + 1}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Pillar</span>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                    value={card.pillar}
                    onChange={(event) => {
                      const pillar = event.currentTarget.value as HomepageV2Pillar;
                      updateCard('startHereCards', index, {
                        pillar,
                        pillarLabel: pillarLabelFromValue(pillar)
                      });
                    }}
                  >
                    <option value="true_crime">True Crime</option>
                    <option value="history">History</option>
                    <option value="incredible_people">Incredible People</option>
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Episode</span>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                    value={card.episodeSlug}
                    onChange={(event) => handleEpisodeChange('startHereCards', index, event.currentTarget.value)}
                  >
                    {episodes.map((episode) => (
                      <option key={episode.slug} value={episode.slug}>{episode.title}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1 text-sm block">
                <span className="font-medium text-slate-700">Card blurb</span>
                <textarea
                  className="min-h-[74px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={card.customBlurb}
                  onChange={(event) => updateCard('startHereCards', index, { customBlurb: event.currentTarget.value })}
                />
              </label>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-slate-300 bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-900">Popular With Listeners Cards (4-6)</h2>
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={addPopularCard}
            disabled={content.popularCards.length >= 6}
          >
            Add Card
          </button>
        </div>

        <div className="space-y-4">
          {content.popularCards.map((card, index) => (
            <article key={`popular-${index}`} className="rounded-md border border-slate-200 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Card {index + 1}</p>
                <button
                  type="button"
                  className="inline-flex h-8 items-center rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={() => removePopularCard(index)}
                  disabled={content.popularCards.length <= 4}
                >
                  Remove
                </button>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Pillar</span>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                    value={card.pillar}
                    onChange={(event) => {
                      const pillar = event.currentTarget.value as HomepageV2Pillar;
                      updateCard('popularCards', index, {
                        pillar,
                        pillarLabel: pillarLabelFromValue(pillar)
                      });
                    }}
                  >
                    <option value="true_crime">True Crime</option>
                    <option value="history">History</option>
                    <option value="incredible_people">Incredible People</option>
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Episode</span>
                  <select
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                    value={card.episodeSlug}
                    onChange={(event) => handleEpisodeChange('popularCards', index, event.currentTarget.value)}
                  >
                    {episodes.map((episode) => (
                      <option key={episode.slug} value={episode.slug}>{episode.title}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="space-y-1 text-sm block">
                <span className="font-medium text-slate-700">Card blurb</span>
                <textarea
                  className="min-h-[74px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  value={card.customBlurb}
                  onChange={(event) => updateCard('popularCards', index, { customBlurb: event.currentTarget.value })}
                />
              </label>
            </article>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-slate-300 bg-white p-4 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Review Quotes (2)</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((index) => {
            const review = content.reviewQuotes[index] || createBlankReviewQuote();
            return (
              <article key={`review-${index}`} className="rounded-md border border-slate-200 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quote {index + 1}</p>
                <label className="space-y-1 text-sm block">
                  <span className="font-medium text-slate-700">Quote</span>
                  <textarea
                    className="min-h-[88px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    value={review.quote}
                    onChange={(event) => updateReview(index, { quote: event.currentTarget.value })}
                  />
                </label>
                <label className="space-y-1 text-sm block">
                  <span className="font-medium text-slate-700">Author</span>
                  <input
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                    value={review.author}
                    onChange={(event) => updateReview(index, { author: event.currentTarget.value })}
                  />
                </label>
                <label className="space-y-1 text-sm block">
                  <span className="font-medium text-slate-700">Source</span>
                  <input
                    className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
                    value={review.source}
                    onChange={(event) => updateReview(index, { source: event.currentTarget.value })}
                  />
                </label>
              </article>
            );
          })}
        </div>
      </div>

      <div className="rounded-md border border-slate-300 bg-white p-4 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Community and Patreon Copy</h2>
        <label className="space-y-1 text-sm block">
          <span className="font-medium text-slate-700">Community copy</span>
          <textarea
            className="min-h-[110px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={content.communityCopy}
            onChange={(event) => setContent((previous) => ({ ...previous, communityCopy: event.currentTarget.value }))}
          />
        </label>
        <label className="space-y-1 text-sm block">
          <span className="font-medium text-slate-700">Patreon teaser copy</span>
          <textarea
            className="min-h-[110px] w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={content.patreonTeaserCopy}
            onChange={(event) => setContent((previous) => ({ ...previous, patreonTeaserCopy: event.currentTarget.value }))}
          />
        </label>
      </div>

      <div className="sticky bottom-0 z-20 border border-slate-300 bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Changes are saved manually to avoid accidental content drift.</p>
          <button
            type="button"
            className="inline-flex h-10 items-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            onClick={() => void saveContent()}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Homepage V2 Content'}
          </button>
        </div>
      </div>
    </section>
  );
}
