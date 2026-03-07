import type { Metadata } from 'next';
import { EpisodesBrowser } from '@/components/episodes-browser';
import { getPodcastEpisodes, type PodcastEpisode } from '@/lib/podcast';

export const metadata: Metadata = {
  title: {
    absolute: 'All Episodes | The Compendium Podcast'
  },
  description:
    'Browse every Compendium podcast episode in one place. Search by title or episode number, listen inline, and open full episode notes.',
  alternates: {
    canonical: '/episodes'
  },
  openGraph: {
    title: 'All Episodes | The Compendium Podcast',
    description:
      'Browse every Compendium podcast episode in one place. Search by title or episode number, listen inline, and open full episode notes.',
    url: '/episodes'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'All Episodes | The Compendium Podcast',
    description:
      'Browse every Compendium podcast episode in one place. Search by title or episode number, listen inline, and open full episode notes.'
  }
};

export default async function EpisodesPage() {
  let episodes: PodcastEpisode[] = [];
  let hasFeedError = false;

  try {
    episodes = await getPodcastEpisodes({ descriptionMaxLength: 520 });
  } catch (error) {
    hasFeedError = true;
    console.error('Failed to load podcast episodes:', error);
  }

  return (
    <section>
      <h1 className="mb-2 flex items-center gap-3 text-4xl font-black">
        All Episodes
        {episodes.length > 0 ? (
          <span className="rounded-full bg-carnival-red px-3 py-0.5 text-sm font-black text-white">{episodes.length}</span>
        ) : null}
      </h1>
      <p className="mb-6 text-carnival-ink/80">
        Browse every episode from newest to oldest, or search by title or episode number to find exactly what you&apos;re looking for.
      </p>

      {hasFeedError ? (
        <p className="mb-6 rounded-md border border-carnival-red/30 bg-carnival-red/10 px-4 py-3 font-semibold text-carnival-ink">
          We could not load episodes from the RSS feed right now. Please try again in a moment.
        </p>
      ) : null}

      <EpisodesBrowser episodes={episodes} />
    </section>
  );
}
