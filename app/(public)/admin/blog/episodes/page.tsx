import { AdminBlogEpisodesManager } from '@/components/blog/admin-episodes-manager';
import { listEpisodeSyncLogs, listPodcastEpisodes } from '@/lib/blog/data';

export const dynamic = 'force-dynamic';

export default async function AdminBlogEpisodesPage() {
  const [episodes, logs] = await Promise.all([
    listPodcastEpisodes({ includeHidden: true }),
    listEpisodeSyncLogs()
  ]);
  return <AdminBlogEpisodesManager initialEpisodes={episodes} initialLogs={logs} />;
}
