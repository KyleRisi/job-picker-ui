import { unstable_noStore as noStore } from 'next/cache';
import { WorkspaceEpisodesTable } from '@/components/workspace/workspace-episodes-table';
import { WorkspaceEpisodesActions } from '@/components/workspace/workspace-episodes-actions';
import { getPodcastEpisodes, type PodcastEpisode } from '@/lib/podcast';
import { listWorkspacePrepublishDraftRows } from '@/lib/episode-prepublish-drafts';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkspaceEpisodesPage() {
  noStore();

  let episodes: PodcastEpisode[] = [];
  let draftRows: Awaited<ReturnType<typeof listWorkspacePrepublishDraftRows>> = [];
  let feedError = '';

  try {
    episodes = await getPodcastEpisodes({ descriptionMaxLength: 520, includeEditorialMeta: true });
    draftRows = await listWorkspacePrepublishDraftRows();
  } catch (error) {
    feedError = 'Could not load episodes from the RSS feed right now.';
    console.error('Workspace episodes feed failed to load:', error);
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Episodes</h1>
          <p className="text-sm text-slate-600">View live episodes and prepublish drafts, apply filters, and open editor workflows.</p>
        </div>
        <WorkspaceEpisodesActions />
      </header>

      {feedError ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{feedError}</p>
      ) : null}

      <WorkspaceEpisodesTable episodes={episodes} draftRows={draftRows} />
    </section>
  );
}
