import { schedule } from '@netlify/functions';
import { syncPodcastEpisodes } from '@/lib/blog/rss-sync';

export const handler = schedule('@hourly', async () => {
  await syncPodcastEpisodes();
  return {
    statusCode: 200,
    body: 'ok'
  };
});
