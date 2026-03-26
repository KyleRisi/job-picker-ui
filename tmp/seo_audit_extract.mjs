import { writeFileSync } from 'node:fs';

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

function allTagText(html, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    out.push(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  }
  return out.filter(Boolean);
}

function allAnchors(html) {
  const re = /<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    const href = (m[1] || '').trim();
    const text = (m[2] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    out.push({ href, text });
  }
  return out;
}

function allIds(html) {
  const re = /\sid=["']([^"']+)["']/gi;
  const out = new Set();
  let m;
  while ((m = re.exec(html))) out.add(m[1]);
  return out;
}

function extractJsonLdTypes(html) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const types = new Set();
  let m;
  while ((m = re.exec(html))) {
    const raw = (m[1] || '').trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
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
          for (const v of Object.values(item)) {
            if (v && (typeof v === 'object')) stack.push(v);
          }
        }
      }
    } catch {
      // ignore malformed
    }
  }
  return [...types];
}

async function fetchChain(url, headers = {}) {
  const chain = [];
  let current = url;
  for (let i = 0; i < 10; i++) {
    const res = await fetch(current, { redirect: 'manual', headers });
    const h = Object.fromEntries(res.headers.entries());
    chain.push({ url: current, status: res.status, headers: h });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), current).toString();
      continue;
    }
    const body = await res.text();
    return { chain, finalUrl: current, status: res.status, headers: h, body };
  }
  throw new Error(`Too many redirects for ${url}`);
}

const results = [];
for (const path of pages) {
  const full = `${base}${path}`;
  const normal = await fetchChain(full);
  const hostPreview = await fetchChain(full, { host: 'www.thecompendiumpodcast.com' });

  const html = normal.body || '';
  const title = pickTitle(html);
  const description = pickMeta(html, 'name', 'description');
  const robotsMeta = pickMeta(html, 'name', 'robots');
  const canonical = pickLink(html, 'canonical');
  const ogTitle = pickMeta(html, 'property', 'og:title');
  const ogDescription = pickMeta(html, 'property', 'og:description');
  const ogImage = pickMeta(html, 'property', 'og:image');
  const ogUrl = pickMeta(html, 'property', 'og:url');
  const twTitle = pickMeta(html, 'name', 'twitter:title');
  const twDescription = pickMeta(html, 'name', 'twitter:description');
  const twImage = pickMeta(html, 'name', 'twitter:image');

  const h1 = allTagText(html, 'h1');
  const h2 = allTagText(html, 'h2');
  const h3 = allTagText(html, 'h3');
  const anchors = allAnchors(html);
  const ids = [...allIds(html)];
  const hashAnchors = anchors.filter((a) => a.href.startsWith('#')).map((a) => a.href.slice(1));
  const missingHashTargets = [...new Set(hashAnchors.filter((id) => !ids.includes(id)))];

  const internalLinks = [...new Set(
    anchors
      .map((a) => a.href)
      .filter((href) => href.startsWith('/') || href.startsWith(base))
      .map((href) => href.startsWith(base) ? href.slice(base.length) || '/' : href)
      .map((href) => href.split('#')[0])
      .filter(Boolean)
  )];

  results.push({
    path,
    status: normal.status,
    finalUrl: normal.finalUrl,
    redirectChain: normal.chain.map((c) => ({ url: c.url, status: c.status, location: c.headers.location || null })),
    headers: {
      robotsTag: normal.headers['x-robots-tag'] || null,
      contentType: normal.headers['content-type'] || null,
      cacheControl: normal.headers['cache-control'] || null,
      contentLength: normal.headers['content-length'] || null
    },
    metadata: {
      title,
      titleLength: title ? title.length : 0,
      description,
      descriptionLength: description ? description.length : 0,
      robotsMeta,
      canonical,
      ogTitle,
      ogDescription,
      ogImage,
      ogUrl,
      twitterTitle: twTitle,
      twitterDescription: twDescription,
      twitterImage: twImage
    },
    headings: { h1, h2, h3, h1Count: h1.length, h2Count: h2.length, h3Count: h3.length },
    schemaTypes: extractJsonLdTypes(html),
    htmlBytes: Buffer.byteLength(html, 'utf8'),
    links: {
      totalAnchors: anchors.length,
      sampleAnchors: anchors.slice(0, 30),
      internalLinks,
      missingHashTargets
    },
    canonicalHostProbe: {
      status: hostPreview.status,
      finalUrl: hostPreview.finalUrl,
      redirectChain: hostPreview.chain.map((c) => ({ url: c.url, status: c.status, location: c.headers.location || null })),
      robotsTag: hostPreview.headers['x-robots-tag'] || null,
      htmlTitle: pickTitle(hostPreview.body || ''),
      robotsMeta: pickMeta(hostPreview.body || '', 'name', 'robots')
    }
  });
}

const sitemapRes = await fetch(`${base}/sitemap.xml`);
const sitemapText = await sitemapRes.text();
const robotsRes = await fetch(`${base}/robots.txt`);
const robotsTxt = await robotsRes.text();

// Validate internal links discovered in-scope
const allInternal = [...new Set(results.flatMap((r) => r.links.internalLinks))];
const linkChecks = [];
for (const href of allInternal) {
  if (!href.startsWith('/')) continue;
  try {
    const chk = await fetchChain(`${base}${href}`);
    linkChecks.push({ href, status: chk.status, finalUrl: chk.finalUrl, redirects: chk.chain.length - 1 });
  } catch (error) {
    linkChecks.push({ href, status: 0, error: String(error) });
  }
}

const output = {
  auditedAt: new Date().toISOString(),
  base,
  pages: results,
  sitemap: {
    status: sitemapRes.status,
    contentType: sitemapRes.headers.get('content-type'),
    hasTopics: sitemapText.includes('/topics</loc>') || sitemapText.includes('/topics<'),
    hasPreviewHomepageV2: sitemapText.includes('/preview/homepage-v2'),
    hasTopicHubs: {
      trueCrime: sitemapText.includes('/topics/true-crime'),
      history: sitemapText.includes('/topics/history'),
      incrediblePeople: sitemapText.includes('/topics/incredible-people'),
      scams: sitemapText.includes('/topics/scams-hoaxes-cons'),
      disasters: sitemapText.includes('/topics/disasters-survival'),
      mysteries: sitemapText.includes('/topics/mysteries-unexplained'),
      cults: sitemapText.includes('/topics/cults-belief-moral-panics'),
      popCulture: sitemapText.includes('/topics/pop-culture-entertainment')
    },
    bytes: Buffer.byteLength(sitemapText, 'utf8')
  },
  robots: {
    status: robotsRes.status,
    contentType: robotsRes.headers.get('content-type'),
    body: robotsTxt
  },
  internalLinkChecks: linkChecks
};

writeFileSync('tmp/seo_audit_extract.json', JSON.stringify(output, null, 2));
console.log('Wrote tmp/seo_audit_extract.json');
