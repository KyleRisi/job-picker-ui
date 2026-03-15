import fs from 'node:fs';

const input = JSON.parse(fs.readFileSync('tmp/taxonomy-audit/410-reconsideration-review.json', 'utf8'));
const lines = [
  '| Route | Decision | GSC (90d) | Internal pageviews (180d) | Backlinks | Notes |',
  '|---|---|---:|---:|---|---|'
];

for (const row of input.targets || []) {
  const gsc = `${row.gsc_recent_clicks} clicks / ${row.gsc_recent_impressions} imp`;
  const pageviews = row.internal_pageviews_180d ?? 'n/a';
  const backlinks = row.backlinks_available ? 'available' : 'unavailable';
  const notes = String(row.evidence || '').replace(/\|/g, '/');
  lines.push(`| ${row.route} | ${row.decision} | ${gsc} | ${pageviews} | ${backlinks} | ${notes} |`);
}

fs.writeFileSync('tmp/taxonomy-audit/410-reconsideration-review.md', `${lines.join('\n')}\n`);
console.log('wrote tmp/taxonomy-audit/410-reconsideration-review.md');
