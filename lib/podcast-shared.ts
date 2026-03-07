export type PodcastEpisode = {
  id: string;
  slug: string;
  title: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  publishedAt: string;
  description: string;
  descriptionHtml: string;
  audioUrl: string;
  artworkUrl: string | null;
  duration: string | null;
  sourceUrl: string | null;
};

export function formatEpisodeDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';

  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(parsed);
}
