import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const base = process.env.AUDIT_BASE || 'http://localhost:4030';
const hostHeader = process.env.AUDIT_HOST || 'www.thecompendiumpodcast.com';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
await page.setExtraHTTPHeaders({ host: hostHeader });

const targets = ['/', '/preview/homepage-v2'];
const out = {};

for (const path of targets) {
  const requests = [];
  const responses = [];

  page.removeAllListeners('request');
  page.removeAllListeners('response');

  page.on('request', (req) => {
    requests.push({ url: req.url(), resourceType: req.resourceType() });
  });

  page.on('response', async (res) => {
    const req = res.request();
    const headers = res.headers();
    const lenHeader = Number(headers['content-length'] || 0);
    let bodySize = 0;
    try {
      const buf = await res.body();
      bodySize = buf.byteLength;
    } catch {}
    responses.push({
      url: res.url(),
      status: res.status(),
      resourceType: req.resourceType(),
      contentType: headers['content-type'] || '',
      contentLength: lenHeader,
      bodySize
    });
  });

  const resp = await page.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  const perf = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return nav ? {
      domContentLoadedMs: nav.domContentLoadedEventEnd,
      loadMs: nav.loadEventEnd,
      transferSize: nav.transferSize,
      encodedBodySize: nav.encodedBodySize,
      decodedBodySize: nav.decodedBodySize
    } : null;
  });

  const totals = responses.reduce((acc, r) => {
    const size = r.bodySize || r.contentLength || 0;
    acc.totalBytes += size;
    acc.requestCount += 1;
    if (r.resourceType === 'script') acc.jsBytes += size;
    if (r.resourceType === 'image') acc.imageBytes += size;
    if (r.resourceType === 'document') acc.documentBytes += size;
    return acc;
  }, { totalBytes: 0, jsBytes: 0, imageBytes: 0, documentBytes: 0, requestCount: 0 });

  out[path] = {
    status: resp?.status() || 0,
    perf,
    totals,
    topImages: responses
      .filter((r) => r.resourceType === 'image')
      .sort((a, b) => (b.bodySize || b.contentLength || 0) - (a.bodySize || a.contentLength || 0))
      .slice(0, 8)
      .map((r) => ({ url: r.url, size: r.bodySize || r.contentLength || 0, contentType: r.contentType })),
    topScripts: responses
      .filter((r) => r.resourceType === 'script')
      .sort((a, b) => (b.bodySize || b.contentLength || 0) - (a.bodySize || a.contentLength || 0))
      .slice(0, 8)
      .map((r) => ({ url: r.url, size: r.bodySize || r.contentLength || 0 })),
    requestSample: responses.slice(0, 20)
  };
}

await browser.close();
writeFileSync('tmp/homepage_route_weights.json', JSON.stringify(out, null, 2));
console.log('Wrote tmp/homepage_route_weights.json');
