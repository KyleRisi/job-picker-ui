import { assertDateInput } from '../date-utils.mjs';
import { formatFloat, formatNumber, formatPercent } from '../formatters.mjs';
import { querySearchAnalytics } from '../gsc-client.mjs';

function parseDimensions(raw) {
  if (!raw) {
    return ['query'];
  }

  const allowed = new Set(['query', 'page', 'country', 'device', 'date']);
  const dimensions = raw
    .split(',')
    .map((dimension) => dimension.trim())
    .filter(Boolean);

  if (!dimensions.length) {
    return ['query'];
  }

  for (const dimension of dimensions) {
    if (!allowed.has(dimension)) {
      throw new Error(`Unsupported dimension \"${dimension}\". Allowed: query,page,country,device,date`);
    }
  }

  return dimensions;
}

export async function runQuerySearchAnalyticsCommand(flags) {
  const property = flags.property;
  const startDate = flags['start-date'];
  const endDate = flags['end-date'];

  if (!property) {
    throw new Error('Missing required flag --property <Search Console property URL>.');
  }
  if (!startDate || !endDate) {
    throw new Error('Missing required flags --start-date YYYY-MM-DD and --end-date YYYY-MM-DD.');
  }

  const start = assertDateInput(startDate, 'start-date');
  const end = assertDateInput(endDate, 'end-date');
  if (start > end) {
    throw new Error('start-date must be earlier than or equal to end-date.');
  }

  const rowLimit = Number(flags['row-limit'] || 25);
  if (!Number.isInteger(rowLimit) || rowLimit <= 0 || rowLimit > 25000) {
    throw new Error('row-limit must be an integer between 1 and 25000.');
  }

  const dimensions = parseDimensions(flags.dimensions);

  const data = await querySearchAnalytics({
    siteUrl: property,
    startDate,
    endDate,
    dimensions,
    rowLimit,
  });

  const rows = data.rows || [];

  console.log(`Search analytics for ${property}`);
  console.log(`Date range: ${startDate} to ${endDate}`);
  console.log(`Rows returned: ${rows.length}`);
  console.log('');

  if (!rows.length) {
    console.log('No rows returned for this date range.');
    return;
  }

  rows.forEach((row) => {
    const keys = row.keys?.length ? row.keys.join(' | ') : '(no key)';
    console.log(`${keys}`);
    console.log(
      `  Clicks ${formatNumber(row.clicks)} | Impressions ${formatNumber(row.impressions)} | CTR ${formatPercent(row.ctr || 0)} | Avg Pos ${formatFloat(row.position || 0)}`
    );
  });
}
