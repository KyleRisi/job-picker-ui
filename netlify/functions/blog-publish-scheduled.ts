import { schedule } from '@netlify/functions';
import { publishDueScheduledPosts } from '@/lib/blog/data';

export const handler = schedule('*/5 * * * *', async () => {
  await publishDueScheduledPosts();
  return {
    statusCode: 200,
    body: 'ok'
  };
});
