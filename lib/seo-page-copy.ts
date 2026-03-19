import type { DiscoveryHubPage, ResolvedPodcastEpisode } from '@/lib/podcast-shared';

const HUB_INDEX_COPY: Record<'topics' | 'collections', { title: string; description: string }> = {
  topics: {
    title: 'Podcast Topics: True Crime, History, Mysteries',
    description: 'Explore The Compendium Podcast by topic, including true crime, history, mysteries, scams, survival stories, and more.'
  },
  collections: {
    title: 'Podcast Collections: Curated Story Archives',
    description: 'Browse curated Compendium collections that group connected stories, cases, and long-running narrative threads.'
  }
};

function stripMarkdown(value: string) {
  return value
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/[*_`#>-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function trimTo(value: string, maxLength: number) {
  const normalized = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

export function getHubIndexSeo(routeKey: 'topics' | 'collections') {
  return HUB_INDEX_COPY[routeKey];
}

export function resolveHubIntroText(hub: DiscoveryHubPage) {
  const fromIntro = stripMarkdown(`${hub.term.introMarkdown || ''}`);
  if (fromIntro) return trimTo(fromIntro, 320);
  const fromDescription = `${hub.term.description || ''}`.trim();
  if (fromDescription) return trimTo(fromDescription, 320);
  return '';
}

export function resolveEpisodeSummary(episode: ResolvedPodcastEpisode) {
  const candidates = [
    `${episode.editorial?.excerpt || ''}`,
    `${episode.metaDescription || ''}`,
    `${episode.excerpt || ''}`,
    `${episode.source?.descriptionPlain || ''}`
  ].map((value) => value.replace(/\s+/g, ' ').trim()).filter(Boolean);

  if (!candidates.length) return '';
  return trimTo(candidates[0], 320);
}
