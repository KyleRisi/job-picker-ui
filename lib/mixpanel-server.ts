const MIXPANEL_TOKEN = 'c2d2aeb94e8712b97cab8d12817dc3aa';

export async function trackMixpanelServer(eventName: string, properties: Record<string, unknown> = {}) {
  try {
    const payload = {
      event: eventName,
      properties: {
        token: MIXPANEL_TOKEN,
        ...properties
      }
    };
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64');

    await fetch('https://api.mixpanel.com/track?ip=1', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: `data=${encodeURIComponent(encodedPayload)}`
    });
  } catch {
    // Best-effort analytics only.
  }
}
