import { z } from 'zod';
import type { PodcastEpisode } from '@/lib/podcast-shared';
import type { PublicReview } from '@/lib/reviews';
import { createSupabaseAdminClient } from '@/lib/supabase';

export const HOMEPAGE_V2_CONTENT_SETTINGS_KEY = 'homepage_v2_content';

export type HomepageV2Pillar = 'true_crime' | 'history' | 'incredible_people';

export type HomepageV2CuratedCard = {
  pillar: HomepageV2Pillar;
  pillarLabel: string;
  episodeSlug: string;
  customBlurb: string;
};

export type HomepageV2ReviewQuote = {
  quote: string;
  author: string;
  source: string;
};

export type HomepageV2Content = {
  heroSupportingCopy: string;
  startHereCards: HomepageV2CuratedCard[];
  popularCards: HomepageV2CuratedCard[];
  reviewQuotes: HomepageV2ReviewQuote[];
  communityCopy: string;
  patreonTeaserCopy: string;
};

const curatedCardSchema = z.object({
  pillar: z.enum(['true_crime', 'history', 'incredible_people']),
  pillarLabel: z.string().trim().min(2).max(32),
  episodeSlug: z.string().trim().min(3).max(240),
  customBlurb: z.string().trim().min(12).max(280)
});

const reviewQuoteSchema = z.object({
  quote: z.string().trim().min(12).max(300),
  author: z.string().trim().min(2).max(100),
  source: z.string().trim().min(2).max(60)
});

export const homepageV2ContentSchema = z.object({
  heroSupportingCopy: z.string().trim().min(40).max(320),
  startHereCards: z.array(curatedCardSchema).length(3),
  popularCards: z.array(curatedCardSchema).min(4).max(6),
  reviewQuotes: z.array(reviewQuoteSchema).length(2),
  communityCopy: z.string().trim().min(40).max(500),
  patreonTeaserCopy: z.string().trim().min(40).max(500)
});

function toPillarLabel(pillar: HomepageV2Pillar): string {
  if (pillar === 'true_crime') return 'True Crime';
  if (pillar === 'history') return 'History';
  return 'Incredible People';
}

function truncate(value: string, maxLength: number): string {
  const normalized = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function pillarFromTopicSlug(topicSlug: string | null | undefined): HomepageV2Pillar {
  if (topicSlug === 'history') return 'history';
  if (topicSlug === 'incredible-people') return 'incredible_people';
  return 'true_crime';
}

function firstEpisodeByTopic(episodes: PodcastEpisode[], topicSlug: string): PodcastEpisode | null {
  return episodes.find((episode) => episode.primaryTopicSlug === topicSlug) || null;
}

function cardFromEpisode(episode: PodcastEpisode, overridePillar?: HomepageV2Pillar): HomepageV2CuratedCard {
  const pillar = overridePillar || pillarFromTopicSlug(episode.primaryTopicSlug);
  return {
    pillar,
    pillarLabel: toPillarLabel(pillar),
    episodeSlug: episode.slug,
    customBlurb: truncate(episode.description, 180)
      || 'A standout episode that captures the tone and storytelling style of The Compendium.'
  };
}

function dedupeByEpisodeSlug(cards: HomepageV2CuratedCard[]): HomepageV2CuratedCard[] {
  const seen = new Set<string>();
  return cards.filter((card) => {
    const slug = `${card.episodeSlug || ''}`.trim().toLowerCase();
    if (!slug || seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
}

export function buildHomepageV2AutoSeedContent(episodes: PodcastEpisode[], reviews: PublicReview[]): HomepageV2Content {
  const normalizedEpisodes = [...episodes].sort((left, right) => {
    const leftTime = Date.parse(left.publishedAt || '') || 0;
    const rightTime = Date.parse(right.publishedAt || '') || 0;
    return rightTime - leftTime;
  });

  const trueCrimeStarter = firstEpisodeByTopic(normalizedEpisodes, 'true-crime') || normalizedEpisodes[0] || null;
  const historyStarter = firstEpisodeByTopic(normalizedEpisodes, 'history') || normalizedEpisodes[1] || normalizedEpisodes[0] || null;
  const peopleStarter = firstEpisodeByTopic(normalizedEpisodes, 'incredible-people') || normalizedEpisodes[2] || normalizedEpisodes[0] || null;

  const startHereCards = [
    trueCrimeStarter ? cardFromEpisode(trueCrimeStarter, 'true_crime') : null,
    historyStarter ? cardFromEpisode(historyStarter, 'history') : null,
    peopleStarter ? cardFromEpisode(peopleStarter, 'incredible_people') : null
  ].filter(Boolean) as HomepageV2CuratedCard[];

  const popularPool = dedupeByEpisodeSlug([
    ...normalizedEpisodes.filter((episode) => episode.primaryTopicSlug === 'true-crime').slice(0, 2).map((episode) => cardFromEpisode(episode, 'true_crime')),
    ...normalizedEpisodes.filter((episode) => episode.primaryTopicSlug === 'history').slice(0, 2).map((episode) => cardFromEpisode(episode, 'history')),
    ...normalizedEpisodes.filter((episode) => episode.primaryTopicSlug === 'incredible-people').slice(0, 2).map((episode) => cardFromEpisode(episode, 'incredible_people')),
    ...normalizedEpisodes.slice(0, 10).map((episode) => cardFromEpisode(episode))
  ]);

  const reviewQuotes: HomepageV2ReviewQuote[] = reviews
    .slice(0, 2)
    .map((review) => ({
      quote: truncate(review.body, 220) || 'Brilliant stories and consistently excellent delivery.',
      author: review.author || 'Listener',
      source: review.platform === 'apple' ? 'Apple Podcasts' : 'Website review'
    }));

  const content = {
    heroSupportingCopy:
      'A weekly podcast uncovering dark history, bizarre crimes, remarkable lives, and real stories stranger than fiction — all told in one gripping, stand-alone listen.',
    startHereCards,
    popularCards: popularPool.slice(0, 5),
    reviewQuotes: reviewQuotes.length === 2
      ? reviewQuotes
      : [
          {
            quote: 'Compelling storytelling, fantastic research, and brilliant chemistry between the hosts.',
            author: 'Compendium listener',
            source: 'Apple Podcasts'
          },
          {
            quote: 'One of the best podcasts for true stories. Entertaining, informative, and always memorable.',
            author: 'Compendium listener',
            source: 'Website review'
          }
        ],
    communityCopy:
      'The Compendium is more than a feed. It is a growing circle of curious, darkly amused, story-obsessed listeners who like their history strange, their crime gripping, and their people unforgettable.',
    patreonTeaserCopy:
      'Support the show on Patreon and unlock early access, bonus episodes, private RSS listening, ad-free listening on selected tiers, and supporter perks from backstage.'
  } satisfies HomepageV2Content;

  const parsed = homepageV2ContentSchema.safeParse(content);
  if (parsed.success) return parsed.data;

  throw new Error('Homepage V2 auto-seed content failed schema validation.');
}

export function parseHomepageV2Content(rawValue: unknown): HomepageV2Content | null {
  const parsed = homepageV2ContentSchema.safeParse(rawValue);
  if (!parsed.success) return null;
  return parsed.data;
}

export async function getStoredHomepageV2Content(): Promise<HomepageV2Content | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', HOMEPAGE_V2_CONTENT_SETTINGS_KEY)
    .maybeSingle();

  if (error || !data?.value) return null;
  return parseHomepageV2Content(data.value);
}

export async function getHomepageV2Content(input: {
  episodes: PodcastEpisode[];
  reviews: PublicReview[];
}): Promise<{ content: HomepageV2Content; source: 'settings' | 'auto_seed' }> {
  const stored = await getStoredHomepageV2Content();
  if (stored) {
    return { content: stored, source: 'settings' };
  }

  return {
    content: buildHomepageV2AutoSeedContent(input.episodes, input.reviews),
    source: 'auto_seed'
  };
}

export async function saveHomepageV2Content(content: HomepageV2Content) {
  const validated = homepageV2ContentSchema.parse(content);
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('settings')
    .upsert({ key: HOMEPAGE_V2_CONTENT_SETTINGS_KEY, value: validated }, { onConflict: 'key' });

  if (error) throw error;
}
