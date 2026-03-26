import { writeFileSync } from 'node:fs';

const base = 'http://localhost:4010';
const pages = [
  '/topics/true-crime','/topics/history','/topics/incredible-people','/topics/scams-hoaxes-cons','/topics/disasters-survival','/topics/mysteries-unexplained','/topics/cults-belief-moral-panics','/topics/pop-culture-entertainment','/topics','/preview/homepage-v2'
];

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
}

function pickImgUrls(html) {
  const urls = [];
  const re = /<img[^>]*src=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const src = decodeEntities((m[1] || '').trim());
    if (src.startsWith('/_next/image')) urls.push(src);
  }
  return [...new Set(urls)];
}

async function probe(u) {
  const url = `${base}${u}`;
  try {
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    return { u, status: res.status, bytes: buf.byteLength, type: res.headers.get('content-type') || '', cache: res.headers.get('cache-control') || '' };
  } catch (e) {
    return { u, status: 0, error: String(e) };
  }
}

const out = [];
for (const p of pages) {
  const html = await (await fetch(`${base}${p}`)).text();
  const imgs = pickImgUrls(html).slice(0, 8);
  const probes = [];
  for (const img of imgs) probes.push(await probe(img));
  out.push({ path: p, sampleCount: probes.length, probes });
}

writeFileSync('tmp/seo_image_probe2.json', JSON.stringify(out, null, 2));
console.log('Wrote tmp/seo_image_probe2.json');
