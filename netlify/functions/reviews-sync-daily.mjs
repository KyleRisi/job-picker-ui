export const config = {
  schedule: '@daily'
};

export async function handler() {
  const baseUrl = process.env.URL || process.env.DEPLOY_PRIME_URL;
  const secret = process.env.REVIEWS_SYNC_SECRET;

  if (!baseUrl) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing Netlify URL/DEPLOY_PRIME_URL.' })
    };
  }

  if (!secret) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Missing REVIEWS_SYNC_SECRET.' })
    };
  }

  const target = `${baseUrl.replace(/\/$/, '')}/api/internal/reviews/sync`;

  const res = await fetch(target, {
    method: 'POST',
    headers: {
      'x-reviews-sync-secret': secret
    }
  });

  const text = await res.text();
  return {
    statusCode: res.status,
    body: text || '{}'
  };
}
