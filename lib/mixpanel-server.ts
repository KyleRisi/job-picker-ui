const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || '';
const MIXPANEL_API_HOST = process.env.NEXT_PUBLIC_MIXPANEL_API_HOST || 'https://api.mixpanel.com';

export async function trackMixpanelServer(eventName: string, properties: Record<string, unknown> = {}) {
  if (!MIXPANEL_TOKEN) return;

  try {
    const payload = {
      event: eventName,
      properties: {
        token: MIXPANEL_TOKEN,
        ...properties
      }
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');

    const response = await fetch(`${MIXPANEL_API_HOST}/track?ip=1&verbose=1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `data=${encodeURIComponent(encodedPayload)}`
    });

    if (process.env.NODE_ENV !== 'production' && !response.ok) {
      console.warn('[mixpanel] Server track failed', response.status, await response.text());
    }
  } catch {
    // Best-effort analytics only.
  }
}
