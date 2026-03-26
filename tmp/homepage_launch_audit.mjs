import { writeFileSync } from 'node:fs';

const base = process.env.AUDIT_BASE || 'http://localhost:4030';
const hosts = {
  canonical: 'www.thecompendiumpodcast.com',
  apex: 'thecompendiumpodcast.com',
  localhost: 'localhost:4030',
  preview: 'deploy-preview-123--compendium-circus-hr.netlify.app'
};

const routes = ['/', '/preview/homepage-v2', '/sitemap.xml', '/robots.txt'];

function pickMeta(html, attr, value, contentAttr='content') {
  const re = new RegExp(`<meta[^>]*${attr}=["']${value}["'][^>]*${contentAttr}=["']([^"']*)["'][^>]*>|<meta[^>]*${contentAttr}=["']([^"']*)["'][^>]*${attr}=["']${value}["'][^>]*>`, 'i');
  const m = html.match(re);
  return (m?.[1] || m?.[2] || '').trim() || null;
}
function pickLink(html, rel) {
  const re = new RegExp(`<link[^>]*rel=["']${rel}["'][^>]*href=["']([^"']*)["'][^>]*>|<link[^>]*href=["']([^"']*)["'][^>]*rel=["']${rel}["'][^>]*>`, 'i');
  const m = html.match(re);
  return (m?.[1] || m?.[2] || '').trim() || null;
}
function pickTitle(html) {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  return (m?.[1] || '').replace(/\s+/g, ' ').trim() || null;
}
function schemaTypes(html) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const types = new Set();
  let m;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse((m[1] || '').trim());
      const stack = [parsed];
      while (stack.length) {
        const item = stack.pop();
        if (!item) continue;
        if (Array.isArray(item)) {
          for (const v of item) stack.push(v);
          continue;
        }
        if (typeof item === 'object') {
          const t = item['@type'];
          if (Array.isArray(t)) t.forEach((x) => typeof x === 'string' && types.add(x));
          else if (typeof t === 'string') types.add(t);
          for (const v of Object.values(item)) if (v && typeof v === 'object') stack.push(v);
        }
      }
    } catch {}
  }
  return [...types];
}

async function fetchChain(path, host) {
  const chain = [];
  let url = `${base}${path}`;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(url, { redirect: 'manual', headers: { host } });
    const headers = Object.fromEntries(res.headers.entries());
    chain.push({ url, status: res.status, location: headers.location || null });
    if (res.status >= 300 && res.status < 400 && headers.location) {
      url = new URL(headers.location, url).toString();
      continue;
    }
    const body = await res.text();
    return { chain, finalUrl: url, status: res.status, headers, body };
  }
  throw new Error('redirect loop');
}

const out = {};
for (const [hostName, host] of Object.entries(hosts)) {
  out[hostName] = {};
  for (const route of routes) {
    const res = await fetchChain(route, host);
    const row = {
      status: res.status,
      finalUrl: res.finalUrl,
      chain: res.chain,
      headers: {
        xRobotsTag: res.headers['x-robots-tag'] || null,
        contentType: res.headers['content-type'] || null,
        cacheControl: res.headers['cache-control'] || null
      }
    };

    if (route === '/' || route === '/preview/homepage-v2') {
      const html = res.body || '';
      row.metadata = {
        title: pickTitle(html),
        description: pickMeta(html, 'name', 'description'),
        robotsMeta: pickMeta(html, 'name', 'robots'),
        canonical: pickLink(html, 'canonical'),
        ogTitle: pickMeta(html, 'property', 'og:title'),
        ogDescription: pickMeta(html, 'property', 'og:description'),
        ogImage: pickMeta(html, 'property', 'og:image'),
        ogUrl: pickMeta(html, 'property', 'og:url'),
        twitterTitle: pickMeta(html, 'name', 'twitter:title'),
        twitterDescription: pickMeta(html, 'name', 'twitter:description'),
        twitterImage: pickMeta(html, 'name', 'twitter:image')
      };
      row.markers = {
        hasHomepageV2RootMarker: html.includes('data-homepage-v2-root="true"'),
        hasV1HeroCopy: html.includes('An Assembly of'),
        hasV2HeroCopy: html.includes('New to the Circus? Start Here') || html.includes('The Compendium Podcast')
      };
      row.schemaTypes = schemaTypes(html);
      row.htmlBytes = Buffer.byteLength(html, 'utf8');
      const anchors = [...html.matchAll(/<a[^>]*href=["']([^"']+)["']/gi)].map((m) => m[1]);
      row.linkSummary = {
        totalAnchors: anchors.length,
        hasTopics: anchors.includes('/topics') || anchors.some((h) => h.startsWith('/topics')),
        hasEpisodes: anchors.includes('/episodes') || anchors.some((h) => h.startsWith('/episodes')),
        hasPatreon: anchors.includes('/patreon') || anchors.some((h) => h.includes('patreon')),
        hasPreviewLink: anchors.includes('/preview/homepage-v2')
      };
    }

    if (route === '/sitemap.xml') {
      const xml = res.body || '';
      row.sitemap = {
        hasRoot: xml.includes('<loc>https://www.thecompendiumpodcast.com/</loc>'),
        hasPreview: xml.includes('/preview/homepage-v2'),
        bytes: Buffer.byteLength(xml, 'utf8')
      };
    }

    if (route === '/robots.txt') {
      const txt = res.body || '';
      row.robotsTxt = {
        sitemapLine: txt.split('\n').find((l) => l.toLowerCase().startsWith('sitemap:')) || null,
        hasDisallowApi: txt.includes('Disallow: /api')
      };
    }

    out[hostName][route] = row;
  }
}

writeFileSync('tmp/homepage_launch_audit.json', JSON.stringify(out, null, 2));
console.log('Wrote tmp/homepage_launch_audit.json');
