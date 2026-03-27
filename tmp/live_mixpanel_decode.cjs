const { chromium } = require('playwright');

const BASE = 'https://www.thecompendiumpodcast.com';

function parseMixpanelData(raw) {
  if (!raw) return null;
  const candidates = [raw];
  try {
    candidates.push(Buffer.from(raw, 'base64').toString('utf8'));
  } catch {}
  for (const c of candidates) {
    try {
      return JSON.parse(c);
    } catch {}
  }
  return null;
}

function extractEventNamesFromBody(body, url) {
  const names = [];
  const payloadCandidates = [];

  if (typeof body === 'string' && body.length) {
    const params = new URLSearchParams(body);
    const data = params.get('data');
    if (data) payloadCandidates.push(data);
  }

  try {
    const u = new URL(url);
    const data = u.searchParams.get('data');
    if (data) payloadCandidates.push(data);
  } catch {}

  for (const raw of payloadCandidates) {
    const payload = parseMixpanelData(raw);
    if (!payload) continue;
    if (Array.isArray(payload)) {
      for (const e of payload) {
        if (e && typeof e.event === 'string') names.push(e.event);
      }
    } else if (payload && typeof payload.event === 'string') {
      names.push(payload.event);
    }
  }

  return names;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });

  await context.addInitScript(() => {
    window.__mpTransportCalls = [];

    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this.__mpUrl = String(url || '');
      this.__mpMethod = String(method || '');
      return origOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function(body) {
      try {
        if ((this.__mpUrl || '').includes('mixpanel')) {
          window.__mpTransportCalls.push({ kind: 'xhr', url: this.__mpUrl, method: this.__mpMethod, body: typeof body === 'string' ? body : '' });
        }
      } catch {}
      return origSend.call(this, body);
    };
  });

  const page = await context.newPage();
  const pause = (ms) => page.waitForTimeout(ms);

  const clickPreventingNav = async (selector) => {
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      el.addEventListener('click', (event) => event.preventDefault(), { once: true });
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return true;
    }, selector);
  };

  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await pause(2200);
  await page.getByRole('button', { name: 'Listen Now' }).first().click();
  await pause(1000);
  await page.getByRole('link', { name: /Listen on Spotify/i }).first().click({ force: true });
  await pause(1800);
  await clickPreventingNav('[data-homepage-v2-event="homepage_reviews_click"]');
  await pause(1800);

  await page.goto(`${BASE}/topics`, { waitUntil: 'domcontentloaded' });
  await pause(1800);
  await clickPreventingNav('[data-discovery-event="topic_card_clicked"]');
  await pause(1800);

  await page.goto(`${BASE}/topics/true-crime`, { waitUntil: 'domcontentloaded' });
  await pause(2200);
  await clickPreventingNav('[data-discovery-event="topic_hub_card_clicked"]');
  await pause(1700);
  await clickPreventingNav('[data-discovery-event="topic_hub_archive_clicked"]');
  await pause(1700);
  await clickPreventingNav('[data-discovery-event="related_topic_clicked"]');
  await pause(2500);

  const calls = await page.evaluate(() => window.__mpTransportCalls || []);
  await browser.close();

  const callEvents = calls.map((c) => ({
    kind: c.kind,
    url: c.url,
    events: extractEventNamesFromBody(c.body || '', c.url || ''),
    bodySample: (c.body || '').slice(0, 180)
  }));

  const allEvents = [...new Set(callEvents.flatMap((c) => c.events))].sort();
  console.log(JSON.stringify({ callsCount: calls.length, callEvents, allEvents }, null, 2));
})();
