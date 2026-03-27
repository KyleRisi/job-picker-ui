const { chromium } = require('playwright');

const BASE = 'https://www.thecompendiumpodcast.com';

function decodePayload(data) {
  try {
    const decoded = Buffer.from(data, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function extractEventsFromRequest(req) {
  const url = req.url();
  if (!/mixpanel\.com\/(track|import)/.test(url)) return [];

  const names = [];
  const candidates = [];

  const postData = req.postData() || '';
  if (postData) {
    const params = new URLSearchParams(postData);
    if (params.get('data')) candidates.push(params.get('data'));
  }

  try {
    const u = new URL(url);
    const dataParam = u.searchParams.get('data');
    if (dataParam) candidates.push(dataParam);
  } catch {}

  for (const c of candidates) {
    if (!c) continue;
    const payload = decodePayload(c);
    if (!payload) continue;
    if (Array.isArray(payload)) {
      for (const item of payload) {
        if (item && typeof item === 'object' && typeof item.event === 'string') names.push(item.event);
      }
    } else if (payload && typeof payload === 'object' && typeof payload.event === 'string') {
      names.push(payload.event);
    }
  }

  return names;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await context.newPage();

  const captured = [];
  page.on('request', (req) => {
    const events = extractEventsFromRequest(req);
    if (!events.length) return;
    for (const eventName of events) {
      captured.push({ event: eventName, url: req.url(), ts: Date.now() });
    }
  });

  const pause = async (ms = 2000) => page.waitForTimeout(ms);

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
  await pause(2500);

  await page.getByRole('button', { name: 'Listen Now' }).first().click();
  await pause(1500);

  await page.getByRole('link', { name: /Listen on Spotify/i }).first().click({ force: true });
  await pause(2500);

  await clickPreventingNav('[data-homepage-v2-event="homepage_reviews_click"]');
  await pause(2500);

  await page.goto(`${BASE}/topics`, { waitUntil: 'domcontentloaded' });
  await pause(2000);
  await clickPreventingNav('[data-discovery-event="topic_card_clicked"]');
  await pause(2200);

  await page.goto(`${BASE}/topics/true-crime`, { waitUntil: 'domcontentloaded' });
  await pause(2500);
  await clickPreventingNav('[data-discovery-event="topic_hub_card_clicked"]');
  await pause(2200);
  await clickPreventingNav('[data-discovery-event="topic_hub_archive_clicked"]');
  await pause(2200);
  await clickPreventingNav('[data-discovery-event="related_topic_clicked"]');
  await pause(2500);

  await browser.close();

  const required = [
    'Listen Now Chooser Opened',
    'External CTA Clicked',
    'homepage_reviews_click',
    'topic_card_clicked',
    'topic_hub_card_clicked',
    'topic_hub_archive_clicked',
    'related_topic_clicked'
  ];

  const seen = new Set(captured.map((e) => e.event));
  const result = {
    required,
    seen: [...seen].sort(),
    missing: required.filter((name) => !seen.has(name)),
    capturedCount: captured.length,
    captured
  };

  console.log(JSON.stringify(result, null, 2));
})();
