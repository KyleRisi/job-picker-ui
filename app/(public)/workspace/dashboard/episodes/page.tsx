import { unstable_noStore as noStore } from 'next/cache';
import { WorkspaceEpisodesTable } from '@/components/workspace/workspace-episodes-table';
import { WorkspaceEpisodesActions } from '@/components/workspace/workspace-episodes-actions';
import { getResolvedEpisodes } from '@/lib/episodes';
import { type PodcastEpisode } from '@/lib/podcast-shared';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkspaceEpisodesPage() {
  noStore();

  let episodes: PodcastEpisode[] = [];
  let feedError = '';

  try {
    const resolvedEpisodes = await getResolvedEpisodes({
      includeHidden: true,
      descriptionMaxLength: 520
    });
    episodes = resolvedEpisodes.map((episode) => ({
      id: episode.id,
      slug: episode.slug,
      title: episode.title,
      seasonNumber: episode.seasonNumber,
      episodeNumber: episode.episodeNumber,
      publishedAt: episode.publishedAt,
      description: episode.description,
      descriptionHtml: episode.descriptionHtml,
      audioUrl: episode.audioUrl,
      artworkUrl: episode.artworkUrl,
      duration: episode.duration,
      sourceUrl: episode.sourceUrl,
      primaryTopicName: episode.primaryTopic?.name || null,
      primaryTopicPath: episode.primaryTopic?.path || null
    }));
  } catch (error) {
    feedError = 'Could not load episodes right now.';
    console.error('Workspace episodes feed failed to load:', error);
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Episodes</h1>
          <p className="text-sm text-slate-600">View episodes, apply filters, and open the public episode page.</p>
        </div>
        <WorkspaceEpisodesActions />
      </header>

      {feedError ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{feedError}</p>
      ) : null}

      <WorkspaceEpisodesTable episodes={episodes} />
    </section>
  );
}
