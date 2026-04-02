import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function parseArgs(argv) {
  return { apply: new Set(argv).has('--apply') };
}

function requireEnv(name) {
  const value = `${process.env[name] || ''}`.trim();
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeText(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value);
}

function toCsvValue(value) {
  const raw = `${value ?? ''}`;
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

async function fetchAll(supabase, table, columns) {
  const rows = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || !data.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

function containsFooter(value) {
  const normalized = `${value || ''}`
    .replace(/\\!/g, '!')
    .replace(/\\\./g, '.')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return normalized.includes('hosted by simplecast') && normalized.includes('pcm.adswizz.com');
}

const REMOVE_PATTERNS = [
  // Plain / markdown
  /Hosted by Simplecast,\s*an AdsWizz company\\?\.\s*See\s*(?:\[[^\]]*pcm\\?\.adswizz\\?\.com[^\]]*\]\([^)]+\)|pcm\\?\.adswizz\\?\.com)\s*for information about our collection and use of personal data for advertising\\?\./gi,
  // HTML link variant
  /Hosted by Simplecast,\s*an AdsWizz company\.\s*See\s*<a[^>]*>pcm\.adswizz\.com<\/a>\s*for information about our collection and use of personal data for advertising\./gi
];

function stripFooter(value) {
  if (typeof value !== 'string' || !value) return value;
  let next = value;
  for (const pattern of REMOVE_PATTERNS) {
    next = next.replace(pattern, '');
  }
  return next
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildMd(report) {
  return [
    '# Episode Simplecast Footer Removal',
    '',
    `- Generated: ${report.generated_at}`,
    `- Mode: ${report.mode}`,
    '',
    '## Totals',
    `- Episodes scanned: ${report.totals.episodes_scanned}`,
    `- Editorial rows scanned: ${report.totals.editorial_rows_scanned}`,
    `- Episodes changed: ${report.totals.episodes_changed}`,
    `- Editorial rows changed: ${report.totals.editorial_rows_changed}`,
    '',
    '## Verification',
    `- podcast_episodes.show_notes still containing footer: ${report.verification.podcast_episodes.show_notes}`,
    `- podcast_episodes.description_plain still containing footer: ${report.verification.podcast_episodes.description_plain}`,
    `- podcast_episodes.description_html still containing footer: ${report.verification.podcast_episodes.description_html}`,
    `- podcast_episode_editorial.body_markdown still containing footer: ${report.verification.podcast_episode_editorial.body_markdown}`,
    ''
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabase = createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false }
  });

  const outDir = path.join(process.cwd(), 'tmp', 'taxonomy-audit', 'postdeploy', 'simplecast-footer-removal');
  ensureDir(outDir);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');

  const [episodes, editorialRows] = await Promise.all([
    fetchAll(supabase, 'podcast_episodes', 'id,slug,title,show_notes,description_plain,description_html'),
    fetchAll(supabase, 'podcast_episode_editorial', 'id,episode_id,web_slug,web_title,body_markdown')
  ]);

  const episodeChanges = [];
  const editorialChanges = [];

  for (const row of episodes) {
    const changes = {};
    const nextShowNotes = stripFooter(row.show_notes);
    const nextDescriptionPlain = stripFooter(row.description_plain);
    const nextDescriptionHtml = stripFooter(row.description_html);
    if ((row.show_notes || '') !== (nextShowNotes || '')) changes.show_notes = nextShowNotes;
    if ((row.description_plain || '') !== (nextDescriptionPlain || '')) changes.description_plain = nextDescriptionPlain;
    if ((row.description_html || '') !== (nextDescriptionHtml || '')) changes.description_html = nextDescriptionHtml;
    if (Object.keys(changes).length) {
      episodeChanges.push({
        id: row.id,
        slug: row.slug,
        title: row.title,
        before: {
          show_notes: row.show_notes || '',
          description_plain: row.description_plain || '',
          description_html: row.description_html || ''
        },
        changes
      });
    }
  }

  for (const row of editorialRows) {
    const nextBody = stripFooter(row.body_markdown);
    if ((row.body_markdown || '') !== (nextBody || '')) {
      editorialChanges.push({
        id: row.id,
        episode_id: row.episode_id,
        web_slug: row.web_slug,
        web_title: row.web_title,
        before: { body_markdown: row.body_markdown || '' },
        changes: { body_markdown: nextBody }
      });
    }
  }

  const beforePath = path.join(outDir, `before-state-${stamp}.json`);
  writeJson(beforePath, {
    generated_at: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    episode_changes: episodeChanges,
    editorial_changes: editorialChanges
  });

  if (args.apply) {
    const nowIso = new Date().toISOString();
    for (const row of episodeChanges) {
      const { error } = await supabase.from('podcast_episodes').update({ ...row.changes, updated_at: nowIso }).eq('id', row.id);
      if (error) throw new Error(`podcast_episodes ${row.id}: ${error.message}`);
    }
    for (const row of editorialChanges) {
      const { error } = await supabase.from('podcast_episode_editorial').update({ ...row.changes, updated_at: nowIso }).eq('id', row.id);
      if (error) throw new Error(`podcast_episode_editorial ${row.id}: ${error.message}`);
    }
  }

  const [verifyEpisodes, verifyEditorialRows] = args.apply
    ? await Promise.all([
        fetchAll(supabase, 'podcast_episodes', 'id,show_notes,description_plain,description_html'),
        fetchAll(supabase, 'podcast_episode_editorial', 'id,body_markdown')
      ])
    : [episodes, editorialRows];

  const verification = {
    podcast_episodes: {
      show_notes: verifyEpisodes.filter((row) => containsFooter(row.show_notes)).length,
      description_plain: verifyEpisodes.filter((row) => containsFooter(row.description_plain)).length,
      description_html: verifyEpisodes.filter((row) => containsFooter(row.description_html)).length
    },
    podcast_episode_editorial: {
      body_markdown: verifyEditorialRows.filter((row) => containsFooter(row.body_markdown)).length
    }
  };

  const deltaRows = [
    ['table', 'id', 'slug', 'title', 'field', 'changed'].join(',')
  ];
  for (const row of episodeChanges) {
    for (const field of Object.keys(row.changes)) {
      deltaRows.push([
        'podcast_episodes',
        row.id,
        row.slug,
        row.title,
        field,
        true
      ].map(toCsvValue).join(','));
    }
  }
  for (const row of editorialChanges) {
    deltaRows.push([
      'podcast_episode_editorial',
      row.id,
      row.web_slug || '',
      row.web_title || '',
      'body_markdown',
      true
    ].map(toCsvValue).join(','));
  }
  const deltaCsvPath = path.join(outDir, `delta-${stamp}.csv`);
  writeText(deltaCsvPath, `${deltaRows.join('\n')}\n`);

  const report = {
    generated_at: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    totals: {
      episodes_scanned: episodes.length,
      editorial_rows_scanned: editorialRows.length,
      episodes_changed: episodeChanges.length,
      editorial_rows_changed: editorialChanges.length,
      total_rows_changed: episodeChanges.length + editorialChanges.length
    },
    verification,
    paths: {
      before_state_json: beforePath,
      delta_csv: deltaCsvPath
    }
  };

  const reportJson = path.join(outDir, `report-${stamp}.json`);
  const reportMd = path.join(outDir, `report-${stamp}.md`);
  const latestJson = path.join(outDir, 'report.latest.json');
  const latestMd = path.join(outDir, 'report.latest.md');
  writeJson(reportJson, report);
  writeText(reportMd, buildMd(report));
  writeJson(latestJson, report);
  writeText(latestMd, buildMd(report));

  console.log(JSON.stringify(report, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
