const DEFAULT_DEPLOY_URL = 'https://main--compendium-circus-hr.netlify.app/';

function normalizeHomeUrl(input) {
  const value = (input || '').trim();
  const raw = value || DEFAULT_DEPLOY_URL;
  const url = new URL(raw);
  if (!url.pathname || url.pathname === '') url.pathname = '/';
  if (url.pathname !== '/') url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url;
}

function extractChunkPaths(html) {
  const matches = html.match(/\/_next\/static\/chunks\/[^"'`\s<>]+\.js/g) || [];
  return Array.from(new Set(matches)).sort();
}

async function headStatus(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return response.status;
  } catch {
    return 0;
  }
}

async function main() {
  const input = process.argv[2] || process.env.DEPLOY_URL || '';
  const homeUrl = normalizeHomeUrl(input);

  console.log(`Checking deploy homepage: ${homeUrl.toString()}`);
  const homeResponse = await fetch(homeUrl, { redirect: 'follow' });
  if (!homeResponse.ok) {
    console.error(`FAIL: homepage request returned ${homeResponse.status}`);
    process.exit(1);
  }

  const html = await homeResponse.text();
  const chunkPaths = extractChunkPaths(html);
  if (chunkPaths.length === 0) {
    console.error('FAIL: no /_next/static/chunks/*.js references found in homepage HTML');
    process.exit(1);
  }

  console.log(`Found ${chunkPaths.length} chunk references.`);
  const failures = [];
  for (const path of chunkPaths) {
    const assetUrl = new URL(path, homeUrl.origin);
    const status = await headStatus(assetUrl);
    if (status !== 200) {
      failures.push({ path, status });
      console.error(`FAIL ${status} ${path}`);
    } else {
      console.log(`OK   ${status} ${path}`);
    }
  }

  if (failures.length > 0) {
    console.error(`Chunk integrity check failed: ${failures.length} non-200 responses.`);
    process.exit(1);
  }

  console.log('Chunk integrity check passed.');
}

main().catch((error) => {
  console.error('Unexpected failure in deploy integrity check.');
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
