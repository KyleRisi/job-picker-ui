const { chromium } = require('playwright');

const BASE = 'https://www.thecompendiumpodcast.com';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });

  await context.addInitScript(() => {
    window.__mpTrackCalls = [];
    window.__mpTransportCalls = [];

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const input = args[0];
        const url = typeof input === 'string' ? input : input?.url || '';
        if (String(url).includes('mixpanel')) {
          window.__mpTransportCalls.push({ kind: 'fetch', url: String(url) });
        }
      } catch {}
      return originalFetch.apply(window, args);
    };

    const originalSendBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => {
      try {
        if (String(url).includes('mixpanel')) {
          window.__mpTransportCalls.push({ kind: 'beacon', url: String(url), data: typeof data === 'string' ? data.slice(0, 160) : String(data) });
        }
      } catch {}
      return originalSendBeacon(url, data);
    };

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
          window.__mpTransportCalls.push({ kind: 'xhr', url: this.__mpUrl, method: this.__mpMethod, body: typeof body === 'string' ? body.slice(0, 160) : String(body) });
        }
      } catch {}
      return origSend.call(this, body);
    };

    let internalMixpanel = undefined;
    Object.defineProperty(window, 'mixpanel', {
      configurable: true,
      get() {
        return internalMixpanel;
      },
      set(value) {
        if (value && typeof value.track === 'function' && !value.__trackWrappedForSmoke) {
          const originalTrack = value.track.bind(value);
          value.track = function(eventName, props, cb) {
            try {
              window.__mpTrackCalls.push({ event: String(eventName), props: props || null, ts: Date.now() });
            } catch {}
            return originalTrack(eventName, props, cb);
          };
          value.__trackWrappedForSmoke = true;
        }
        internalMixpanel = value;
      }
    });
  });

  const page = await context.newPage();

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
  await pause(1200);

  await page.getByRole('link', { name: /Listen on Spotify/i }).first().click({ force: true });
  await pause(2200);

  await clickPreventingNav('[data-homepage-v2-event="homepage_reviews_click"]');
  await pause(2200);

  await page.goto(`${BASE}/topics`, { waitUntil: 'domcontentloaded' });
  await pause(2200);
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

  const trackCalls = await page.evaluate(() => window.__mpTrackCalls || []);
  const transportCalls = await page.evaluate(() => window.__mpTransportCalls || []);

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

  const seen = new Set(trackCalls.map((e) => e.event));

  console.log(JSON.stringify({
    required,
    seen: [...seen].sort(),
    missing: required.filter((name) => !seen.has(name)),
    trackCallCount: trackCalls.length,
    transportCallCount: transportCalls.length,
    trackCalls,
    transportCalls
  }, null, 2));
})();
