import fs from 'node:fs';

const inPath = 'tmp/taxonomy-audit/live-active-redirects.json';
const outCsv = 'tmp/taxonomy-audit/live-active-redirects.csv';
const outSummary = 'tmp/taxonomy-audit/live-active-redirects-summary.json';

const rows = JSON.parse(fs.readFileSync(inPath, 'utf8'));
const header = ['source_path','target_url','status_code','match_type','is_active','priority','source_type','source_ref','created_at','updated_at'];

const esc = (v) => {
  const s = `${v ?? ''}`;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const csvLines = [header.join(',')];
for (const row of rows) {
  csvLines.push(header.map((k) => esc(row[k])).join(','));
}
fs.writeFileSync(outCsv, `${csvLines.join('\n')}\n`);

const classifyGroup = (sourceType) => {
  const s = `${sourceType ?? ''}`.trim().toLowerCase();
  if (s === 'taxonomy_archive' || s === 'taxonomy_route_policy' || s.startsWith('taxonomy')) return 'taxonomy_archive';
  if (s === 'blog_slug') return 'blog_slug';
  if (s === 'blog_import') return 'blog_import';
  if (s === 'manual' || s === 'editorial' || s === 'manual/editorial' || s === 'manual_editorial') return 'manual/editorial';
  return 'unknown/other';
};

const groups = ['taxonomy_archive','blog_slug','blog_import','manual/editorial','unknown/other'];
const byGroup = Object.fromEntries(groups.map((g) => [g, []]));
for (const row of rows) byGroup[classifyGroup(row.source_type)].push(row);

function groupStats(items) {
  const bySourcePath = new Map();
  const dupKeyCount = new Map();

  for (const row of items) {
    const sp = `${row.source_path ?? ''}`;
    if (bySourcePath.has(sp) === false) bySourcePath.set(sp, []);
    bySourcePath.get(sp).push(row);

    const dupKey = [
      row.source_path ?? '',
      row.target_url ?? '',
      row.status_code ?? '',
      row.match_type ?? '',
      row.is_active ?? '',
      row.priority ?? '',
      row.source_type ?? '',
      row.source_ref ?? ''
    ].join('|');
    dupKeyCount.set(dupKey, (dupKeyCount.get(dupKey) ?? 0) + 1);
  }

  const suspiciousDuplicates = [];
  for (const [key, count] of dupKeyCount.entries()) {
    if (count > 1) suspiciousDuplicates.push({ key, count });
  }

  const conflictingSourcePathEntries = [];
  for (const [sourcePath, rowsForPath] of bySourcePath.entries()) {
    const variant = new Set(rowsForPath.map((r) => [r.target_url ?? '', r.status_code ?? '', r.match_type ?? '', r.source_type ?? '', r.source_ref ?? '', r.priority ?? ''].join('|')));
    if (variant.size > 1) {
      conflictingSourcePathEntries.push({
        source_path: sourcePath,
        row_count: rowsForPath.length,
        variants: variant.size
      });
    }
  }

  const exacts = items.filter((r) => `${r.match_type ?? ''}` === 'exact');
  const prefixes = items.filter((r) => `${r.match_type ?? ''}` === 'prefix');
  const overlaps = [];
  for (const ex of exacts) {
    const exPath = `${ex.source_path ?? ''}`.toLowerCase();
    for (const pr of prefixes) {
      const prPath = `${pr.source_path ?? ''}`.toLowerCase();
      if (!exPath || !prPath) continue;
      const overlapsPath = prPath === '/'
        ? exPath.startsWith('/')
        : exPath === prPath || exPath.startsWith(`${prPath}/`);
      if (overlapsPath) {
        overlaps.push({ exact_source_path: ex.source_path, prefix_source_path: pr.source_path });
      }
    }
  }

  return {
    active_row_count: items.length,
    count_410: items.filter((r) => Number(r.status_code) === 410).length,
    count_302_307: items.filter((r) => Number(r.status_code) === 302 || Number(r.status_code) === 307).length,
    prefix_rule_count: prefixes.length,
    suspicious_duplicates_count: suspiciousDuplicates.length,
    suspicious_duplicates: suspiciousDuplicates,
    conflicting_source_path_entries_count: conflictingSourcePathEntries.length,
    conflicting_source_path_entries: conflictingSourcePathEntries,
    exact_prefix_overlaps_count: overlaps.length,
    exact_prefix_overlaps: overlaps
  };
}

const summary = {
  generated_at: new Date().toISOString(),
  total_active_rows: rows.length,
  source_types_present: [...new Set(rows.map((r) => r.source_type ?? null))].sort(),
  group_summary: Object.fromEntries(groups.map((g) => [g, groupStats(byGroup[g])]))
};

fs.writeFileSync(outSummary, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({
  total_active_rows: summary.total_active_rows,
  source_types_present: summary.source_types_present,
  group_counts: Object.fromEntries(groups.map((g) => [g, summary.group_summary[g].active_row_count]))
}, null, 2));
