import path from 'node:path';
import { querySearchAnalytics } from '../tools/google-search-console/src/gsc-client.mjs';
import {
  OUTPUT_ROOT,
  SELECTED_BLOG_PATHS,
  SELECTED_EPISODE_PATHS,
  SELECTED_HUB_PATHS,
  parseArgs,
  writeJson,
  writeText
} from './seo-phase1-shared.mjs';

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseDate(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${value}`);
  return parsed;
}

function addDays(isoDate, days) {
  const d = parseDate(isoDate);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}

function normalizeHost(urlString) {
  try {
    const parsed = new URL(urlString);
    return parsed.pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '';
  }
}

function aggregateMetricsForPage(rows, targetPath) {
  const normalizedTarget = normalizeHost(targetPath);
  const matches = rows.filter((row) => normalizeHost(row.keys?.[0] || '') === normalizedTarget);
  if (!matches.length) return { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  const totals = matches.reduce((acc, row) => {
    acc.clicks += row.clicks || 0;
    acc.impressions += row.impressions || 0;
    acc.positionWeighted += (row.position || 0) * (row.impressions || 0);
    return acc;
  }, { clicks: 0, impressions: 0, positionWeighted: 0 });
  const ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
  const position = totals.impressions > 0 ? totals.positionWeighted / totals.impressions : 0;
  return { clicks: totals.clicks, impressions: totals.impressions, ctr, position };
}

function topQueriesForPage(rows, targetPath) {
  const normalizedTarget = normalizeHost(targetPath);
  const grouped = new Map();
  for (const row of rows) {
    const pageKey = normalizeHost(row.keys?.[0] || '');
    if (pageKey !== normalizedTarget) continue;
    const query = row.keys?.[1] || '';
    if (!query) continue;
    const existing = grouped.get(query) || { query, clicks: 0, impressions: 0, positionWeighted: 0 };
    existing.clicks += row.clicks || 0;
    existing.impressions += row.impressions || 0;
    existing.positionWeighted += (row.position || 0) * (row.impressions || 0);
    grouped.set(query, existing);
  }
  return [...grouped.values()]
    .map((item) => ({
      query: item.query,
      clicks: item.clicks,
      impressions: item.impressions,
      ctr: item.impressions > 0 ? item.clicks / item.impressions : 0,
      position: item.impressions > 0 ? item.positionWeighted / item.impressions : 0
    }))
    .sort((a, b) => b.impressions - a.impressions || b.clicks - a.clicks)
    .slice(0, 10);
}

function renderMd(title, payload) {
  const lines = [
    `# ${title}`,
    '',
    `- Generated at: ${payload.generated_at}`,
    `- Property: ${payload.property}`,
    `- Date range: ${payload.start_date} to ${payload.end_date}`,
    ''
  ];

  if (payload.rollout_date) {
    lines.push(`- Rollout date: ${payload.rollout_date}`);
    lines.push('');
  }

  lines.push('| Page | Impressions | Clicks | CTR | Avg Position | Top Queries |');
  lines.push('| --- | ---: | ---: | ---: | ---: | --- |');

  for (const row of payload.rows) {
    const topQueries = (row.top_queries || []).slice(0, 3).map((item) => `${item.query} (${item.impressions})`).join('; ');
    lines.push(`| ${row.path} | ${row.impressions} | ${row.clicks} | ${(row.ctr * 100).toFixed(2)}% | ${row.position.toFixed(2)} | ${topQueries} |`);
  }

  lines.push('');
  return `${lines.join('\n')}\n`;
}

async function buildSnapshot({ property, startDate, endDate, selectedPaths }) {
  const pageRows = (await querySearchAnalytics({
    siteUrl: property,
    startDate,
    endDate,
    dimensions: ['page'],
    rowLimit: 25000
  })).rows || [];

  const queryRows = (await querySearchAnalytics({
    siteUrl: property,
    startDate,
    endDate,
    dimensions: ['page', 'query'],
    rowLimit: 25000
  })).rows || [];

  const rows = [];
  for (const routePath of selectedPaths) {
    const pageUrl = `https://www.thecompendiumpodcast.com${routePath}`;
    const metrics = aggregateMetricsForPage(pageRows, pageUrl);
    const topQueries = topQueriesForPage(queryRows, pageUrl);
    rows.push({
      path: routePath,
      page_url: pageUrl,
      ...metrics,
      top_queries: topQueries
    });
  }

  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const property = args.property || 'sc-domain:thecompendiumpodcast.com';
  const asOfDate = args['as-of-date'] || formatDate(new Date());
  const endDate = args['end-date'] || asOfDate;
  const startDate = args['start-date'] || addDays(endDate, -27);
  const rolloutDate = args['rollout-date'] || null;

  const selectedPaths = [
    ...SELECTED_HUB_PATHS,
    ...SELECTED_EPISODE_PATHS,
    ...SELECTED_BLOG_PATHS
  ];

  const rows = await buildSnapshot({ property, startDate, endDate, selectedPaths });

  const metricsDir = path.join(OUTPUT_ROOT, 'metrics');
  const baselineJsonPath = path.join(metricsDir, `baseline-${asOfDate}.json`);
  const baselineMdPath = path.join(metricsDir, `baseline-${asOfDate}.md`);

  const baseline = {
    generated_at: new Date().toISOString(),
    property,
    start_date: startDate,
    end_date: endDate,
    rows
  };

  writeJson(baselineJsonPath, baseline);
  writeText(baselineMdPath, renderMd(`SEO Baseline (${asOfDate})`, baseline));

  const checkpoints = [14, 28, 56];
  for (const days of checkpoints) {
    const filePath = path.join(metricsDir, `delta-day${days}.md`);
    const targetDate = rolloutDate ? addDays(rolloutDate, days) : null;
    const lines = [
      `# SEO Delta Day ${days}`,
      '',
      `- Baseline file: baseline-${asOfDate}.json`,
      `- Rollout date: ${rolloutDate || 'pending_production_rollout'}`,
      `- Target compare date: ${targetDate || 'pending'}`,
      '',
      'Comparison run is pending until production rollout is complete and target date is reached.',
      ''
    ];
    writeText(filePath, `${lines.join('\n')}\n`);
  }

  console.log(`Wrote baseline JSON: ${baselineJsonPath}`);
  console.log(`Wrote baseline MD: ${baselineMdPath}`);
  console.log('Wrote checkpoint templates: delta-day14.md, delta-day28.md, delta-day56.md');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
