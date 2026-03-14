import { notFound } from 'next/navigation';
import { getResolvedEpisodeBySlug } from '@/lib/episodes';
import { WorkspaceEpisodeEditor } from '@/components/workspace/workspace-episode-editor';

export default async function EpisodeEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const episode = await getResolvedEpisodeBySlug(slug, { includeHidden: true });
  if (!episode) notFound();

  return <WorkspaceEpisodeEditor episode={episode as any} />;
}
