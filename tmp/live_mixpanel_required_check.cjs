const { chromium } = require('playwright');

const BASE = 'https://www.thecompendiumpodcast.com';

function parseData(raw) {
  if (!raw) return null;
  const tries = [raw];
  try { tries.push(Buffer.from(raw, 'base64').toString('utf8')); } catch {}
  for (const t of tries) {
    try { return JSON.parse(t); } catch {}
  }
  return null;
}

function decodeEvents(call) {
  const events = [];
  const candidates = [];
  if (call.body) {
    const params = new URLSearchParams(call.body);
    const data = params.get('data');
    if (data) candidates.push(data);
  }
  try {
    const u = new URL(call.url);
    const data = u.searchParams.get('data');
    if (data) candidates.push(data);
  } catch {}
  for (const c of candidates) {
    const payload = parseData(c);
    if (!payload) continue;
    if (Array.isArray(payload)) {
      for (const item of payload) if (item && typeof item.event === 'string') events.push(item.event);
    } else if (payload && typeof payload.event === 'string') {
      events.push(payload.event);
    }
  }
  return events;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });

  await context.addInitScript(() => {
    window.__mpCalls = [];
    const oOpen = XMLHttpRequest.prototype.open;
    const oSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
      this.__u = String(url || '');
      this.__m = String(method || '');
      return oOpen.call(this, method, url, ...rest);
    };
    XMLHttpRequest.prototype.send = function(body) {
      try {
        if ((this.__u || '').includes('mixpanel')) {
          window.__mpCalls.push({ url: this.__u, method: this.__m, body: typeof body === 'string' ? body : '' });
        }
      } catch {}
      return oSend.call(this, body);
    };
  });

  const page = await context.newPage();
  const wait = (ms) => page.waitForTimeout(ms);

  async function installNavGuard() {
    await page.evaluate(() => {
      if (window.__navGuardInstalled) return;
      window.__navGuardInstalled = true;
      document.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const anchor = target.closest('a[href]');
        if (!anchor) return;
        const href = anchor.getAttribute('href') || '';
        if (href.startsWith('/')) event.preventDefault();
      }, true);
    });
  }

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await installNavGuard();
  await wait(3000);
  await page.getByRole('button', { name: 'Listen Now' }).first().click();
  await wait(1200);
  await page.getByRole('link', { name: /Listen on Spotify/i }).first().click({ force: true });
  await wait(2600);
  await page.locator('[data-homepage-v2-event="homepage_reviews_click"]').first().click({ force: true });
  await wait(3000);

  await page.goto(`${BASE}/topics`, { waitUntil: 'networkidle' });
  await installNavGuard();
  await wait(2500);
  await page.locator('[data-discovery-event="topic_card_clicked"]').first().click({ force: true });
  await wait(2800);

  await page.goto(`${BASE}/topics/true-crime`, { waitUntil: 'networkidle' });
  await installNavGuard();
  await wait(2800);
  await page.locator('[data-discovery-event="topic_hub_card_clicked"]').first().click({ force: true });
  await wait(2200);
  await page.locator('[data-discovery-event="topic_hub_archive_clicked"]').first().click({ force: true });
  await wait(2200);
  await page.locator('[data-discovery-event="related_topic_clicked"]').first().click({ force: true });
  await wait(3500);

  const calls = await page.evaluate(() => window.__mpCalls || []);
  await browser.close();

  const events = [...new Set(calls.flatMap(decodeEvents))].sort();
  const required = [
    'Listen Now Chooser Opened',
    'External CTA Clicked',
    'homepage_reviews_click',
    'topic_card_clicked',
    'topic_hub_card_clicked',
    'topic_hub_archive_clicked',
    'related_topic_clicked'
  ];

  console.log(JSON.stringify({
    callsCount: calls.length,
    events,
    required,
    missing: required.filter((e) => !events.includes(e))
  }, null, 2));
})();
