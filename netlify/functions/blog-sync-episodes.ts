import { schedule } from '@netlify/functions';
import { syncPodcastEpisodes } from '@/lib/blog/rss-sync';

export const handler = schedule('@hourly', async () => {
  // Hourly sync keeps editorial/source-sensitive fields safe by default.
  await syncPodcastEpisodes({ mode: 'auto' });
  return {
    statusCode: 200,
    body: 'ok'
  };
});
