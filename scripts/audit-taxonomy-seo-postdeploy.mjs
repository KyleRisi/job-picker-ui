import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const policyPath = path.join(repoRoot, 'lib', 'taxonomy-route-policy.json');

const TAXONOMY_PREFIXES = ['/topics', '/collections', '/themes', '/series', '/blog/category', '/blog/topic', '/blog/series'];
const REDIRECT_STATUS_CODES = new Set([301, 302, 307, 308]);

function parseArgs(argv) {
  const args = {
    base: 'https://www.thecompendiumpodcast.com',
    outDir: path.join(repoRoot, 'tmp', 'taxonomy-audit', 'postdeploy'),
    maxCrawlPages: 300,
    timeoutMs: 12000
  };

  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];
    if (current === '--base' && next) {
      args.base = next;
      i += 1;
      continue;
    }
    if (current === '--out-dir' && next) {
      args.outDir = path.isAbsolute(next) ? next : path.join(repoRoot, next);
      i += 1;
      continue;
    }
    if (current === '--max-crawl-pages' && next) {
      const value = Number(next);
      if (Number.isFinite(value) && value > 0) args.maxCrawlPages = Math.floor(value);
      i += 1;
      continue;
    }
    if (current === '--timeout-ms' && next) {
      const value = Number(next);
      if (Number.isFinite(value) && value >= 1000) args.timeoutMs = Math.floor(value);
      i += 1;
    }
  }

  return args;
}

function normalizePath(input) {
  const raw = `${input || ''}`.trim();
  if (!raw) return '/';
  let value = raw;
  if (!value.startsWith('/')) value = `/${value}`;
  const [pathOnly] = value.split('?');
  const compact = pathOnly.replace(/\/+/g, '/');
  if (compact === '/') return '/';
  return compact.replace(/\/+$/, '').toLowerCase() || '/';
}

function normalizeBaseUrl(input) {
  const raw = `${input || ''}`.trim();
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  const url = new URL(withProtocol);
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url;
}

function asAbsoluteUrl(base, routeOrUrl) {
  if (/^https?:\/\//i.test(routeOrUrl)) return new URL(routeOrUrl).toString();
  return new URL(routeOrUrl, base).toString();
}

function loadPolicy() {
  const raw = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  return {
    approvedTopics: new Set((raw.approved_topics || []).map((slug) => normalizePath(`/topics/${slug}`))),
    approvedCollections: new Set((raw.approved_collections || []).map((slug) => normalizePath(`/collections/${slug}`))),
    routes: (raw.routes || []).map((entry) => ({
      ...entry,
      route: normalizePath(entry.route),
      redirect_destination: entry.redirect_destination ? normalizePath(entry.redirect_destination) : null
    }))
  };
}

function isTaxonomyOrDiscoveryPath(routePath) {
  const normalized = normalizePath(routePath);
  return TAXONOMY_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

function parseSitemapLocs(xml) {
  const set = new Set();
  const regex = /<loc>(.*?)<\/loc>/gi;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const value = `${match[1] || ''}`.trim();
    if (!value) continue;
    try {
      const parsed = new URL(value);
      set.add(normalizePath(parsed.pathname));
    } catch {
      // Ignore invalid loc nodes.
    }
  }
  return set;
}

function parseCanonicalHref(html) {
  const canonicalMatch = html.match(/<link[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/i);
  if (!canonicalMatch) return null;
  const hrefMatch = canonicalMatch[0].match(/href=["']([^"']+)["']/i);
  if (!hrefMatch?.[1]) return null;
  return hrefMatch[1].trim();
}

function extractInternalLinks(html, origin) {
  const links = [];
  const regex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = `${match[1] || ''}`.trim();
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
      continue;
    }
    try {
      const resolved = new URL(href, origin);
      if (resolved.origin !== origin) continue;
      links.push(normalizePath(resolved.pathname));
    } catch {
      // ignore bad href
    }
  }
  return links;
}

function toCsv(rows) {
  const header = [
    'url',
    'expected_state',
    'actual_status',
    'final_url',
    'canonical_found',
    'canonical_expected',
    'present_in_sitemap',
    'internally_linked',
    'incorrect_public_chip_rendering',
    'pass_fail',
    'failure_reason'
  ];

  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push([
      row.url,
      row.expected_state,
      `${row.actual_status || ''}`,
      row.final_url || '',
      row.canonical_found || '',
      row.canonical_expected || '',
      row.present_in_sitemap ? 'yes' : 'no',
      row.internally_linked ? 'yes' : 'no',
      row.incorrect_public_chip_rendering ? 'yes' : 'no',
      row.pass ? 'pass' : 'fail',
      row.failure_reason || ''
    ].map((value) => `"${`${value}`.replace(/"/g, '""')}"`).join(','));
  }

  return `${lines.join('\n')}\n`;
}

function expectedStateFromAction(action) {
  if (action === 'live_indexable') return 'live_200';
  if (action === 'live_noindex') return 'live_200_noindex';
  if (action === 'redirect_301') return 'redirect_301';
  if (action === 'gone_410') return 'retired_410';
  return 'unknown';
}

function rankFailureCategory(category) {
  const priority = [
    'wrong_http_status',
    'wrong_redirect_destination',
    'retired_or_invalid_url_in_sitemap',
    'retired_or_invalid_url_in_internal_links',
    'incorrect_public_chip_rendering',
    'canonical_mismatch'
  ];
  const index = priority.indexOf(category);
  return index === -1 ? priority.length : index;
}

function groupFailureCategories(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (row.pass || !row.failure_category) continue;
    grouped.set(row.failure_category, (grouped.get(row.failure_category) || 0) + 1);
  }
  return [...grouped.entries()]
    .sort((a, b) => rankFailureCategory(a[0]) - rankFailureCategory(b[0]) || b[1] - a[1])
    .map(([category, count]) => ({ category, count }));
}

function buildRecommendations(groupedFailures) {
  const recommendations = [];
  for (const item of groupedFailures) {
    if (item.category === 'wrong_http_status') {
      recommendations.push('Fix middleware/policy alignment so taxonomy routes return the policy status (200/301/410) consistently in production.');
      continue;
    }
    if (item.category === 'wrong_redirect_destination') {
      recommendations.push('Correct redirect targets in taxonomy policy or active redirect records to match the approved terminal destination.');
      continue;
    }
    if (item.category === 'retired_or_invalid_url_in_sitemap') {
      recommendations.push('Remove retired/invalid taxonomy URLs from sitemap generation and ensure only approved live taxonomy/discovery routes are emitted.');
      continue;
    }
    if (item.category === 'retired_or_invalid_url_in_internal_links') {
      recommendations.push('Update public templates/content so links no longer reference retired or invalid taxonomy/discovery URLs.');
      continue;
    }
    if (item.category === 'incorrect_public_chip_rendering') {
      recommendations.push('Harden public chip rendering filters to exclude inactive, archived, unapproved, or pathless taxonomy terms.');
      continue;
    }
    if (item.category === 'canonical_mismatch') {
      recommendations.push('Fix canonical tags on live taxonomy/discovery pages to the expected route canonical URL.');
    }
  }
  return recommendations;
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function probeUrl(baseUrl, route, timeoutMs) {
  const sourceUrl = asAbsoluteUrl(baseUrl, route);
  let status = 0;
  let firstLocation = null;
  let finalUrl = sourceUrl;
  let canonical = null;

  try {
    const firstResponse = await fetchWithTimeout(sourceUrl, { method: 'GET', redirect: 'manual' }, timeoutMs);
    status = firstResponse.status;
    firstLocation = firstResponse.headers.get('location');
  } catch {
    return { sourceUrl, status: 0, finalUrl: sourceUrl, canonical: null, firstLocation: null, bodyFetchError: true };
  }

  try {
    const followed = await fetchWithTimeout(sourceUrl, { method: 'GET', redirect: 'follow' }, timeoutMs);
    finalUrl = followed.url || sourceUrl;
    const contentType = `${followed.headers.get('content-type') || ''}`.toLowerCase();
    if (followed.status === 200 && contentType.includes('text/html')) {
      const html = await followed.text();
      canonical = parseCanonicalHref(html);
    }
  } catch {
    // Keep defaults when follow fetch fails.
  }

  return {
    sourceUrl,
    status,
    finalUrl,
    canonical,
    firstLocation,
    bodyFetchError: false
  };
}

async function crawlPublicPages({ baseUrl, seedPaths, maxPages, timeoutMs }) {
  const origin = baseUrl.origin;
  const queue = [...new Set(seedPaths.map((p) => normalizePath(p)))];
  const visited = new Set();
  const allLinks = new Map();
  const pageHtmlByPath = new Map();

  while (queue.length > 0 && visited.size < maxPages) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;

    visited.add(current);
    const url = new URL(current, origin).toString();

    try {
      const response = await fetchWithTimeout(url, { method: 'GET', redirect: 'follow' }, timeoutMs);
      if (response.status !== 200) continue;
      const contentType = `${response.headers.get('content-type') || ''}`.toLowerCase();
      if (!contentType.includes('text/html')) continue;

      const html = await response.text();
      pageHtmlByPath.set(current, html);
      const links = extractInternalLinks(html, origin);

      for (const linkPath of links) {
        const key = normalizePath(linkPath);
        if (!allLinks.has(key)) allLinks.set(key, new Set());
        allLinks.get(key).add(current);

        if (!visited.has(key) && queue.length + visited.size < maxPages) {
          queue.push(key);
        }
      }
    } catch {
      // Ignore crawl errors and continue.
    }
  }

  return { visited, allLinks, pageHtmlByPath };
}

function buildPolicyChecks(policyRoutes, baseUrl) {
  return policyRoutes.map((entry) => {
    const expectedCanonical = (entry.action === 'live_indexable' || entry.action === 'live_noindex')
      ? new URL(entry.route, baseUrl).toString()
      : null;

    return {
      type: 'policy',
      route: entry.route,
      absoluteUrl: new URL(entry.route, baseUrl).toString(),
      policyAction: entry.action,
      expectedState: expectedStateFromAction(entry.action),
      expectedStatus: entry.status_code,
      expectedRedirectDestination: entry.redirect_destination,
      expectedCanonical,
      expectedSitemapPresence: entry.action === 'live_indexable'
    };
  });
}

function buildInvalidChecks({ discoveredTaxonomyLinks, policyRoutesByPath, approvedTopics, approvedCollections, baseUrl }) {
  const invalid = [];

  for (const route of discoveredTaxonomyLinks) {
    const normalized = normalizePath(route);
    if (policyRoutesByPath.has(normalized)) continue;

    let isApprovedSpecial = false;
    if (normalized.startsWith('/topics/')) isApprovedSpecial = approvedTopics.has(normalized);
    if (normalized.startsWith('/collections/')) isApprovedSpecial = approvedCollections.has(normalized);

    if (isApprovedSpecial) continue;

    invalid.push({
      type: 'invalid',
      route: normalized,
      absoluteUrl: new URL(normalized, baseUrl).toString(),
      policyAction: 'invalid_unapproved_or_unknown',
      expectedState: 'invalid_or_retired_not_public',
      expectedStatus: 410,
      expectedRedirectDestination: null,
      expectedCanonical: null,
      expectedSitemapPresence: false
    });
  }

  return invalid;
}

function inferFailure(row, check) {
  if (!row.actual_status || row.actual_status === 0) {
    return { pass: false, category: 'wrong_http_status', reason: 'Request failed or timed out.' };
  }

  if (row.actual_status !== check.expectedStatus) {
    return {
      pass: false,
      category: 'wrong_http_status',
      reason: `Expected ${check.expectedStatus} but got ${row.actual_status}.`
    };
  }

  if (check.expectedStatus === 301) {
    const expectedPath = normalizePath(check.expectedRedirectDestination || '/');
    const actualPath = row.redirect_target ? normalizePath(row.redirect_target) : '';
    if (actualPath !== expectedPath) {
      return {
        pass: false,
        category: 'wrong_redirect_destination',
        reason: `Expected redirect to ${expectedPath} but got ${actualPath || '(none)'}.`
      };
    }
  }

  if (check.expectedStatus === 200 && check.expectedCanonical) {
    const canonicalPath = row.canonical_found ? normalizePath(new URL(row.canonical_found, check.absoluteUrl).pathname) : '';
    const expectedCanonicalPath = normalizePath(new URL(check.expectedCanonical).pathname);
    if (canonicalPath !== expectedCanonicalPath) {
      return {
        pass: false,
        category: 'canonical_mismatch',
        reason: `Expected canonical ${check.expectedCanonical} but got ${row.canonical_found || '(missing)'}.`
      };
    }
  }

  if (row.present_in_sitemap !== check.expectedSitemapPresence) {
    return {
      pass: false,
      category: 'retired_or_invalid_url_in_sitemap',
      reason: check.expectedSitemapPresence
        ? 'Expected URL in sitemap but it was missing.'
        : 'Retired/invalid URL appeared in sitemap.'
    };
  }

  if ((check.expectedStatus === 301 || check.expectedStatus === 410 || check.type === 'invalid') && row.internally_linked) {
    return {
      pass: false,
      category: 'retired_or_invalid_url_in_internal_links',
      reason: 'Retired or invalid taxonomy URL is still linked from public pages.'
    };
  }

  if ((check.expectedStatus === 301 || check.expectedStatus === 410 || check.type === 'invalid') && row.incorrect_public_chip_rendering) {
    return {
      pass: false,
      category: 'incorrect_public_chip_rendering',
      reason: 'Retired/invalid taxonomy URL appears as a public discovery chip link.'
    };
  }

  return { pass: true, category: null, reason: '' };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push('# Taxonomy/Discovery Post-Deploy SEO Audit');
  lines.push('');
  lines.push(`- Generated at: ${report.generated_at}`);
  lines.push(`- Base URL: ${report.base_url}`);
  lines.push(`- Total checked: ${report.summary.total_checked}`);
  lines.push(`- Total passed: ${report.summary.total_passed}`);
  lines.push(`- Total failed: ${report.summary.total_failed}`);
  lines.push('');
  lines.push('## Grouped Failure Categories');
  if (!report.grouped_failure_categories.length) {
    lines.push('- None');
  } else {
    for (const item of report.grouped_failure_categories) {
      lines.push(`- ${item.category}: ${item.count}`);
    }
  }
  lines.push('');
  lines.push('## Recommended Fixes (Priority Order)');
  if (!report.recommended_fixes.length) {
    lines.push('- None');
  } else {
    report.recommended_fixes.forEach((fix, index) => {
      lines.push(`${index + 1}. ${fix}`);
    });
  }
  lines.push('');
  lines.push('## Failed Rows');
  const failedRows = report.rows.filter((row) => !row.pass);
  if (!failedRows.length) {
    lines.push('- None');
  } else {
    lines.push('| URL | Expected State | Actual Status | Final URL | Canonical Found | Canonical Expected | In Sitemap | Internally Linked | Incorrect Chip Rendering | Failure Reason |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const row of failedRows) {
      lines.push(`| ${row.url} | ${row.expected_state} | ${row.actual_status || ''} | ${row.final_url || ''} | ${row.canonical_found || ''} | ${row.canonical_expected || ''} | ${row.present_in_sitemap ? 'yes' : 'no'} | ${row.internally_linked ? 'yes' : 'no'} | ${row.incorrect_public_chip_rendering ? 'yes' : 'no'} | ${row.failure_reason || ''} |`);
    }
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args.base);
  const baseOrigin = baseUrl.origin;
  const policy = loadPolicy();
  const policyRoutesByPath = new Map(policy.routes.map((entry) => [normalizePath(entry.route), entry]));

  const policyChecks = buildPolicyChecks(policy.routes, baseUrl.toString());

  const sitemapUrl = new URL('/sitemap.xml', baseOrigin).toString();
  let sitemapPaths = new Set();
  let sitemapFetchError = null;
  try {
    const sitemapResponse = await fetchWithTimeout(sitemapUrl, { method: 'GET', redirect: 'follow' }, args.timeoutMs);
    if (sitemapResponse.ok) {
      const xml = await sitemapResponse.text();
      sitemapPaths = parseSitemapLocs(xml);
    } else {
      sitemapFetchError = `Sitemap request failed with ${sitemapResponse.status}`;
    }
  } catch (error) {
    sitemapFetchError = `Sitemap request error: ${error instanceof Error ? error.message : String(error)}`;
  }

  const crawlSeeds = [
    '/',
    '/episodes',
    '/blog',
    '/topics',
    '/collections',
    ...policyChecks
      .filter((check) => check.expectedStatus === 200)
      .map((check) => check.route)
  ];

  for (const pathFromSitemap of sitemapPaths) {
    if (crawlSeeds.length >= args.maxCrawlPages) break;
    crawlSeeds.push(pathFromSitemap);
  }

  const crawled = await crawlPublicPages({
    baseUrl,
    seedPaths: crawlSeeds,
    maxPages: args.maxCrawlPages,
    timeoutMs: args.timeoutMs
  });

  const discoveredTaxonomyLinks = [...crawled.allLinks.keys()].filter((routePath) => isTaxonomyOrDiscoveryPath(routePath));

  const invalidChecks = buildInvalidChecks({
    discoveredTaxonomyLinks,
    policyRoutesByPath,
    approvedTopics: policy.approvedTopics,
    approvedCollections: policy.approvedCollections,
    baseUrl: baseUrl.toString()
  });

  const allChecks = [...policyChecks, ...invalidChecks];

  const chipSourcePages = [...crawled.pageHtmlByPath.keys()].filter((routePath) => {
    const normalized = normalizePath(routePath);
    return normalized === '/episodes'
      || normalized.startsWith('/episodes/')
      || normalized === '/topics'
      || normalized.startsWith('/topics/')
      || normalized === '/collections'
      || normalized.startsWith('/collections/')
      || normalized === '/blog'
      || normalized.startsWith('/blog/');
  });
  const chipUrlSet = new Set();
  for (const pagePath of chipSourcePages) {
    const html = crawled.pageHtmlByPath.get(pagePath) || '';
    const links = extractInternalLinks(html, baseOrigin);
    for (const link of links) {
      const normalizedLink = normalizePath(link);
      if (isTaxonomyOrDiscoveryPath(normalizedLink)) chipUrlSet.add(normalizedLink);
    }
  }

  const rows = [];

  for (const check of allChecks) {
    const result = await probeUrl(baseUrl.toString(), check.route, args.timeoutMs);

    let redirectTarget = null;
    if (REDIRECT_STATUS_CODES.has(result.status) && result.firstLocation) {
      try {
        redirectTarget = normalizePath(new URL(result.firstLocation, check.absoluteUrl).pathname);
      } catch {
        redirectTarget = normalizePath(result.firstLocation);
      }
    }

    const routePath = normalizePath(check.route);
    const canonicalFound = result.canonical
      ? (() => {
          try {
            return new URL(result.canonical, check.absoluteUrl).toString();
          } catch {
            return result.canonical;
          }
        })()
      : null;

    const row = {
      url: check.absoluteUrl,
      expected_state: check.expectedState,
      actual_status: result.status,
      final_url: result.finalUrl,
      canonical_found: canonicalFound,
      canonical_expected: check.expectedCanonical,
      present_in_sitemap: sitemapPaths.has(routePath),
      internally_linked: crawled.allLinks.has(routePath),
      incorrect_public_chip_rendering: chipUrlSet.has(routePath) && (check.expectedStatus !== 200 || check.type === 'invalid'),
      redirect_target: redirectTarget,
      pass: false,
      failure_reason: '',
      failure_category: null
    };

    const verdict = inferFailure(row, check);
    row.pass = verdict.pass;
    row.failure_reason = verdict.reason;
    row.failure_category = verdict.category;

    rows.push(row);
  }

  const summary = {
    total_checked: rows.length,
    total_passed: rows.filter((row) => row.pass).length,
    total_failed: rows.filter((row) => !row.pass).length
  };

  const groupedFailureCategories = groupFailureCategories(rows);
  const recommendedFixes = buildRecommendations(groupedFailureCategories);

  const report = {
    generated_at: new Date().toISOString(),
    base_url: baseOrigin,
    config: {
      max_crawl_pages: args.maxCrawlPages,
      timeout_ms: args.timeoutMs
    },
    crawl: {
      pages_crawled: crawled.visited.size,
      taxonomy_links_discovered: discoveredTaxonomyLinks.length
    },
    sitemap: {
      url: sitemapUrl,
      paths_parsed: sitemapPaths.size,
      fetch_error: sitemapFetchError
    },
    summary,
    grouped_failure_categories: groupedFailureCategories,
    recommended_fixes: recommendedFixes,
    rows: rows.map((row) => ({
      url: row.url,
      expected_state: row.expected_state,
      actual_status: row.actual_status,
      final_url: row.final_url,
      canonical_found: row.canonical_found,
      canonical_expected: row.canonical_expected,
      present_in_sitemap: row.present_in_sitemap,
      internally_linked: row.internally_linked,
      incorrect_public_chip_rendering: row.incorrect_public_chip_rendering,
      pass: row.pass,
      failure_reason: row.failure_reason,
      failure_category: row.failure_category
    }))
  };

  fs.mkdirSync(args.outDir, { recursive: true });
  const timestamp = report.generated_at.replace(/[.:]/g, '-');
  const jsonPath = path.join(args.outDir, `taxonomy-seo-audit-${timestamp}.json`);
  const csvPath = path.join(args.outDir, `taxonomy-seo-audit-${timestamp}.csv`);
  const mdPath = path.join(args.outDir, `taxonomy-seo-audit-${timestamp}.md`);
  const latestJsonPath = path.join(args.outDir, 'taxonomy-seo-audit.latest.json');
  const latestCsvPath = path.join(args.outDir, 'taxonomy-seo-audit.latest.csv');
  const latestMdPath = path.join(args.outDir, 'taxonomy-seo-audit.latest.md');

  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(csvPath, toCsv(rows));
  fs.writeFileSync(mdPath, renderMarkdown(report));

  fs.writeFileSync(latestJsonPath, JSON.stringify(report, null, 2));
  fs.writeFileSync(latestCsvPath, toCsv(rows));
  fs.writeFileSync(latestMdPath, renderMarkdown(report));

  console.log(`Wrote JSON report: ${jsonPath}`);
  console.log(`Wrote CSV report: ${csvPath}`);
  console.log(`Wrote Markdown report: ${mdPath}`);
  console.log(`Summary: checked=${summary.total_checked} passed=${summary.total_passed} failed=${summary.total_failed}`);

  if (summary.total_failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
