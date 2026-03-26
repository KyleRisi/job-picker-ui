import { readFileSync, writeFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('tmp/seo_audit_extract.json', 'utf8'));
const base = data.base;

function allImgSources(html) {
  const out = [];
  const reImg = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = reImg.exec(html))) out.push(m[1]);
  const rePreload = /<link[^>]*rel=["']preload["'][^>]*as=["']image["'][^>]*imagesrcset=["']([^"']+)["'][^>]*>/gi;
  while ((m = rePreload.exec(html))) {
    const srcset = m[1];
    const first = srcset.split(',')[0]?.trim().split(' ')[0];
    if (first) out.push(first);
  }
  return [...new Set(out)];
}

async function probe(url) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual' });
    const ab = await res.arrayBuffer();
    return {
      url,
      status: res.status,
      contentType: res.headers.get('content-type'),
      contentLengthHeader: res.headers.get('content-length'),
      bytes: ab.byteLength,
      cacheControl: res.headers.get('cache-control')
    };
  } catch (error) {
    return { url, status: 0, error: String(error) };
  }
}

const out = [];
for (const page of data.pages) {
  const html = await (await fetch(`${base}${page.path}`)).text();
  const sources = allImgSources(html)
    .map((s) => s.startsWith('http') ? s : `${base}${s}`)
    .filter((s) => s.startsWith(base));
  const unique = [...new Set(sources)].slice(0, 12);
  const probes = [];
  for (const src of unique) probes.push(await probe(src));
  out.push({ path: page.path, imageCount: sources.length, sampled: probes });
}

writeFileSync('tmp/seo_image_probe.json', JSON.stringify(out, null, 2));
console.log('Wrote tmp/seo_image_probe.json');
