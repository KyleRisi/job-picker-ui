import { daysAgoUtc, toIsoDate } from '../date-utils.mjs';
import { formatFloat, formatNumber, formatPercent, safeDivide, trendWord } from '../formatters.mjs';
import { listSitemaps, querySearchAnalytics } from '../gsc-client.mjs';

function metricTotals(rows) {
  return rows.reduce(
    (acc, row) => {
      acc.clicks += Number(row.clicks || 0);
      acc.impressions += Number(row.impressions || 0);
      acc.position += Number(row.position || 0) * Number(row.impressions || 0);
      return acc;
    },
    { clicks: 0, impressions: 0, position: 0 }
  );
}

function topRowsSummary(title, rows) {
  if (!rows.length) {
    return `${title}: no data in this period.`;
  }

  const lines = rows.slice(0, 5).map((row, index) => {
    const key = row.keys?.[0] || '(unknown)';
    return `${index + 1}) ${key} — ${formatNumber(row.clicks)} clicks, ${formatNumber(row.impressions)} impressions, ${formatPercent(row.ctr || 0)} CTR, avg pos ${formatFloat(row.position || 0)}`;
  });

  return `${title}:\n${lines.join('\n')}`;
}

function deviceSummary(rows) {
  if (!rows.length) {
    return 'Device split: no data in this period.';
  }

  const totalClicks = rows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
  const lines = rows.map((row) => {
    const device = (row.keys?.[0] || 'unknown').toLowerCase();
    const clicks = Number(row.clicks || 0);
    const share = safeDivide(clicks, totalClicks);
    return `- ${device}: ${formatNumber(clicks)} clicks (${formatPercent(share)} of clicks), CTR ${formatPercent(row.ctr || 0)}, avg pos ${formatFloat(row.position || 0)}`;
  });

  return `Device split:\n${lines.join('\n')}`;
}

function performanceNarrative(currentTotals, previousTotals, currentCtr, previousCtr, currentPosition, previousPosition) {
  const clicksTrend = trendWord(currentTotals.clicks, previousTotals.clicks);
  const impressionsTrend = trendWord(currentTotals.impressions, previousTotals.impressions);
  const ctrTrend = trendWord(currentCtr, previousCtr);
  const positionDirection = currentPosition < previousPosition ? 'improved' : currentPosition > previousPosition ? 'declined' : 'held steady';

  return [
    `Recent search demand is ${impressionsTrend}, while traffic is ${clicksTrend}.`,
    `CTR is ${ctrTrend}.`,
    `Average ranking ${positionDirection} (from ${formatFloat(previousPosition)} to ${formatFloat(currentPosition)}).`,
  ].join(' ');
}

function opportunityNotes(queryRows, pageRows) {
  const notes = [];

  const lowCtrQuery = queryRows.find((row) => Number(row.impressions || 0) >= 100 && Number(row.ctr || 0) < 0.02);
  if (lowCtrQuery) {
    notes.push(`High-impression query with low CTR: "${lowCtrQuery.keys?.[0] || 'unknown'}". Consider title/meta snippet updates.`);
  }

  const nearPageOneQuery = queryRows.find((row) => Number(row.position || 100) > 8 && Number(row.position || 100) <= 20);
  if (nearPageOneQuery) {
    notes.push(`Near page-one query opportunity: "${nearPageOneQuery.keys?.[0] || 'unknown'}" (avg pos ${formatFloat(nearPageOneQuery.position)}). Consider focused content/internal links.`);
  }

  const lowCtrPage = pageRows.find((row) => Number(row.impressions || 0) >= 100 && Number(row.ctr || 0) < 0.02);
  if (lowCtrPage) {
    notes.push(`Page with visibility but weak click-through: ${lowCtrPage.keys?.[0] || 'unknown'}. Consider improving title and description.`);
  }

  if (!notes.length) {
    notes.push('No obvious quick-win opportunities were detected from top query/page rows in this window.');
  }

  return `Decision notes:\n- ${notes.join('\n- ')}`;
}

function sitemapNarrative(items) {
  if (!items.length) {
    return 'Sitemaps: none returned by Search Console for this property.';
  }

  const lines = items.slice(0, 5).map((item) => {
    const submitted = item.lastSubmitted || 'unknown';
    const downloaded = item.lastDownloaded || 'unknown';
    const indexed = item.contents?.reduce((sum, content) => sum + Number(content.indexed || 0), 0) || 0;
    const submittedCount = item.contents?.reduce((sum, content) => sum + Number(content.submitted || 0), 0) || 0;

    return `- ${item.path} | submitted: ${submitted} | last downloaded: ${downloaded} | indexed/submitted URLs: ${formatNumber(indexed)}/${formatNumber(submittedCount)}`;
  });

  return `Submitted sitemap summary:\n${lines.join('\n')}`;
}

export async function runInspectSiteReadinessCommand(flags) {
  const property = flags.property;
  if (!property) {
    throw new Error('Missing required flag --property <Search Console property URL>.');
  }

  const recentEnd = toIsoDate(daysAgoUtc(3));
  const recentStart = toIsoDate(daysAgoUtc(30));
  const priorEnd = toIsoDate(daysAgoUtc(31));
  const priorStart = toIsoDate(daysAgoUtc(58));

  const [recent, prior, topQueries, topPages, devices, sitemaps] = await Promise.all([
    querySearchAnalytics({ siteUrl: property, startDate: recentStart, endDate: recentEnd, dimensions: ['date'], rowLimit: 1000 }),
    querySearchAnalytics({ siteUrl: property, startDate: priorStart, endDate: priorEnd, dimensions: ['date'], rowLimit: 1000 }),
    querySearchAnalytics({ siteUrl: property, startDate: recentStart, endDate: recentEnd, dimensions: ['query'], rowLimit: 10 }),
    querySearchAnalytics({ siteUrl: property, startDate: recentStart, endDate: recentEnd, dimensions: ['page'], rowLimit: 10 }),
    querySearchAnalytics({ siteUrl: property, startDate: recentStart, endDate: recentEnd, dimensions: ['device'], rowLimit: 10 }),
    listSitemaps(property).catch(() => []),
  ]);

  const recentRows = recent.rows || [];
  const priorRows = prior.rows || [];
  const queryRows = topQueries.rows || [];
  const pageRows = topPages.rows || [];
  const deviceRows = devices.rows || [];

  const recentTotals = metricTotals(recentRows);
  const priorTotals = metricTotals(priorRows);
  const recentCtr = safeDivide(recentTotals.clicks, recentTotals.impressions);
  const priorCtr = safeDivide(priorTotals.clicks, priorTotals.impressions);
  const recentPosition = safeDivide(recentTotals.position, recentTotals.impressions);
  const priorPosition = safeDivide(priorTotals.position, priorTotals.impressions);

  console.log(`Site readiness snapshot for ${property}`);
  console.log(`Window analyzed: ${recentStart} to ${recentEnd} (compared with ${priorStart} to ${priorEnd})`);
  console.log('');
  console.log('Performance summary');
  console.log(`- Clicks: ${formatNumber(recentTotals.clicks)} (${trendWord(recentTotals.clicks, priorTotals.clicks)})`);
  console.log(`- Impressions: ${formatNumber(recentTotals.impressions)} (${trendWord(recentTotals.impressions, priorTotals.impressions)})`);
  console.log(`- CTR: ${formatPercent(recentCtr)} (${trendWord(recentCtr, priorCtr)})`);
  console.log(`- Avg position: ${formatFloat(recentPosition)} (prior ${formatFloat(priorPosition)})`);
  console.log('');
  console.log('What this suggests');
  console.log(performanceNarrative(recentTotals, priorTotals, recentCtr, priorCtr, recentPosition, priorPosition));
  console.log('');
  console.log(topRowsSummary('Top queries', queryRows));
  console.log('');
  console.log(topRowsSummary('Top pages', pageRows));
  console.log('');
  console.log(deviceSummary(deviceRows));
  console.log('');
  console.log(opportunityNotes(queryRows, pageRows));
  console.log('');
  console.log(sitemapNarrative(sitemaps));
}
