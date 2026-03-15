import fs from 'node:fs';

const summaryPath = 'tmp/taxonomy-audit/410-reconsideration-review.json';
const gscPath = 'tmp/taxonomy-audit/410-gsc-evidence.json';

if (!fs.existsSync(summaryPath)) throw new Error(`Missing ${summaryPath}`);
if (!fs.existsSync(gscPath)) throw new Error(`Missing ${gscPath}`);

const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
const gsc = JSON.parse(fs.readFileSync(gscPath, 'utf8'));

const gscByPath = new Map();
for (const row of (gsc.recentMatches || [])) {
  if (!gscByPath.has(row.path)) gscByPath.set(row.path, { clicks: 0, impressions: 0 });
  const current = gscByPath.get(row.path);
  current.clicks += Number(row.clicks || 0);
  current.impressions += Number(row.impressions || 0);
}

const targets = (summary.targets || []).map((row) => {
  const gscStats = gscByPath.get(row.route) || { clicks: 0, impressions: 0 };
  const evidence = [];
  if (gscStats.clicks > 0 || gscStats.impressions > 0) {
    evidence.push(`GSC ${gscStats.clicks} clicks / ${gscStats.impressions} impressions (recent window)`);
  }
  if (row.internal_analytics_available) {
    evidence.push(`Internal analytics pageviews: ${row.internal_pageviews_180d ?? 0} (last 180d)`);
  } else {
    evidence.push('Internal analytics unavailable');
  }
  if (row.backlinks_available) {
    evidence.push('Backlink evidence available in workspace');
  } else {
    evidence.push('Backlink evidence unavailable in workspace; conservative flag');
  }

  return {
    ...row,
    gsc_recent_clicks: gscStats.clicks,
    gsc_recent_impressions: gscStats.impressions,
    evidence: evidence.join('; ')
  };
});

const next = {
  ...summary,
  generated_at: new Date().toISOString(),
  gsc_window: gsc.recentWindow,
  targets
};

fs.writeFileSync(summaryPath, JSON.stringify(next, null, 2));
console.log(`updated ${summaryPath} (${targets.length} routes)`);
