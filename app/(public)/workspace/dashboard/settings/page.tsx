import { unstable_noStore as noStore } from 'next/cache';
import { getEpisodesLandingPageData } from '@/lib/episodes';
import { getVisibleReviews } from '@/lib/reviews';
import { getHomepageV2Content } from '@/lib/homepage-v2/content';
import { WorkspaceHomepageV2Editor } from '@/components/workspace/workspace-homepage-v2-editor';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function WorkspaceSettingsPage() {
  noStore();

  try {
    const [episodesData, reviews] = await Promise.all([
      getEpisodesLandingPageData(),
      getVisibleReviews(8)
    ]);

    const episodes = episodesData.episodes.slice(0, 120).map((episode) => ({
      slug: episode.slug,
      title: episode.title,
      primaryTopicSlug: `${episode.primaryTopicSlug || ''}`
    }));

    const { content, source } = await getHomepageV2Content({
      episodes: episodesData.episodes,
      reviews
    });

    return (
      <WorkspaceHomepageV2Editor
        initialContent={content}
        episodes={episodes}
        source={source}
      />
    );
  } catch (error) {
    console.error('Workspace settings page failed to load homepage v2 editor:', error);

    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-semibold text-slate-900">Homepage V2 Content</h1>
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          Could not load homepage V2 content editor right now.
        </p>
      </section>
    );
  }
}
