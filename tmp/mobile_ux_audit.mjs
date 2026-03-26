import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';

const base = 'http://localhost:4010';
const pages = [
  '/topics/true-crime',
  '/topics/history',
  '/topics/incredible-people',
  '/topics/scams-hoaxes-cons',
  '/topics/disasters-survival',
  '/topics/mysteries-unexplained',
  '/topics/cults-belief-moral-panics',
  '/topics/pop-culture-entertainment',
  '/topics',
  '/preview/homepage-v2'
];

mkdirSync('tmp/screenshots/mobile', { recursive: true });
mkdirSync('tmp/screenshots/desktop', { recursive: true });

const browser = await chromium.launch({ headless: true });

async function auditForViewport(label, viewport, userAgent) {
  const context = await browser.newContext({ viewport, userAgent });
  const out = [];

  for (const path of pages) {
    const page = await context.newPage();
    const url = `${base}${path}`;
    const response = await page.goto(url, { waitUntil: 'networkidle' });

    const metrics = await page.evaluate(() => {
      const vw = window.innerWidth;
      const overflowNodes = Array.from(document.querySelectorAll('*')).filter((el) => {
        const r = (el).getBoundingClientRect();
        return r.width > vw + 1 || r.right > vw + 1 || r.left < -1;
      }).slice(0, 30).map((el) => {
        const r = (el).getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          className: (el.className || '').toString().slice(0, 120),
          width: Math.round(r.width),
          right: Math.round(r.right),
          left: Math.round(r.left)
        };
      });

      const taps = Array.from(document.querySelectorAll('a, button, [role="button"], input[type="submit"], input[type="button"]'));
      const smallTapTargets = taps.map((el) => {
        const r = (el).getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
          width: Math.round(r.width),
          height: Math.round(r.height)
        };
      }).filter((t) => t.width > 0 && t.height > 0 && (t.width < 44 || t.height < 44)).slice(0, 50);

      const h1s = Array.from(document.querySelectorAll('h1')).map((h) => h.textContent?.replace(/\s+/g, ' ').trim() || '');
      const wraps = Array.from(document.querySelectorAll('h1,h2,.btn-primary,a,button,p')).filter((el) => {
        const cs = window.getComputedStyle(el);
        if (cs.display === 'inline') return false;
        return el.scrollWidth - el.clientWidth > 2;
      }).slice(0, 30).map((el) => ({
        tag: el.tagName.toLowerCase(),
        text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth
      }));

      return {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        documentScrollWidth: document.documentElement.scrollWidth,
        bodyScrollWidth: document.body.scrollWidth,
        overflowCount: overflowNodes.length,
        overflowNodes,
        smallTapTargetCount: smallTapTargets.length,
        smallTapTargets,
        wrappingIssuesCount: wraps.length,
        wrappingIssues: wraps,
        h1s
      };
    });

    const safe = path.replace(/^\//, '').replace(/\//g, '__') || 'home';
    const shotPath = `tmp/screenshots/${label}/${safe}.png`;
    await page.screenshot({ path: shotPath, fullPage: true });

    out.push({
      path,
      status: response?.status() || 0,
      url,
      screenshot: shotPath,
      metrics
    });

    await page.close();
  }

  await context.close();
  return out;
}

const mobile = await auditForViewport('mobile', { width: 390, height: 844 }, 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1');
const desktop = await auditForViewport('desktop', { width: 1366, height: 900 }, 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');

await browser.close();

writeFileSync('tmp/mobile_ux_audit.json', JSON.stringify({ mobile, desktop }, null, 2));
console.log('Wrote tmp/mobile_ux_audit.json');
