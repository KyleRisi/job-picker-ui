import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { AdminEpisodesSection } from '@/components/admin-episodes-section';
import { env } from '@/lib/env';
import { isAdminSessionActive } from '@/lib/admin-session';
import { getPodcastEpisodes, type PodcastEpisode } from '@/lib/podcast';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminEpisodesPage() {
  noStore();

  if (!env.adminAuthDisabled && !isAdminSessionActive()) {
    redirect('/admin');
  }

  let episodes: PodcastEpisode[] = [];
  let feedError = '';

  try {
    episodes = await getPodcastEpisodes({ descriptionMaxLength: 520 });
  } catch (error) {
    feedError = 'Could not load episodes from the RSS feed right now.';
    console.error('Failed to load episodes for admin:', error);
  }

  return (
    <AdminEpisodesSection
      episodes={episodes}
      showBypassBanner={env.adminAuthDisabled}
      feedError={feedError}
    />
  );
}
