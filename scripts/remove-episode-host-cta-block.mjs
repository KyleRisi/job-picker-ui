import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

function parseArgs(argv) {
  const args = new Set(argv);
  return {
    apply: args.has('--apply')
  };
}

function ensureEnv(name) {
  const value = `${process.env[name] || ''}`.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, payload) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function writeText(filePath, text) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text);
}

function toCsvValue(value) {
  const raw = `${value ?? ''}`;
  if (raw.includes(',') || raw.includes('"') || raw.includes('\n')) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

async function fetchAll(supabase, table, columns) {
  const pageSize = 1000;
  let from = 0;
  const rows = [];

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from(table).select(columns).range(from, to);
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || !data.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

function decodeEntities(value) {
  return `${value || ''}`
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function normalizeForAudit(value) {
  return decodeEntities(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\\([!.[\]()])/g, '$1')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*:\s*/g, ': ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const REQUIRED_PATTERNS = {
  hostShowInfoHeading: /Host\s*&\s*Show\s*Info/i,
  hostsLine: /Hosts?:\s*Kyle\s*Risi\s*&\s*Adam\s*Cox/i,
  introMusicLine: /Intro\s*Music:\s*(\[[^\]]*\]\([^)]*\)\s*)?Alice\s+in\s+dark\s+Wonderland/i,
  communityHeading: /Community\s*&\s*Calls\s*to\s*Action/i,
  reviewLine: /Review\s*&\s*follow\s*on:\s*.*Spotify.*Apple\s*Podcasts/i,
  instagramLine: /Instagram\s*:\s*\[?@?theCompendiumPodcast\]?/i,
  websiteLine: /Website\s*:\s*(\[[^\]]*\]\([^)]*\)\s*)?thecompendiumpodcast\.?com/i,
  supportLine: /Support\s*us\s*:\s*(\[[^\]]*\]\([^)]*\)\s*)?Sign\s*up\s*to\s*Patreon/i,
  circusLine: /Circus\s*Job\s*Board\s*:\s*(\[[^\]]*\]\([^)]*\)\s*)?Apply\s*to\s*join\s*the\s*Circus/i,
  shareLine: /Share\s*this\s*episode\s*with\s*a\s*friend!?/i
};

function missingRequirements(value) {
  const normalized = normalizeForAudit(value);
  return Object.entries(REQUIRED_PATTERNS)
    .filter(([, pattern]) => !pattern.test(normalized))
    .map(([key]) => key);
}

const MARKDOWN_BLOCK_PATTERNS = [
  /(?:^|\n)\s*\*\*?\s*Host\s*&\s*Show\s*Info\s*\*\*[\s\S]*?Share this episode with a friend[^\n]*(?:\n|$)/gi
];

const HTML_BLOCK_PATTERNS = [
  /<p>\s*(?:<p>\s*)?<(?:strong|b)>\s*Host\s*&(?:amp;)?\s*Show\s*Info\s*<\/(?:strong|b)>\s*<\/p>[\s\S]*?<p>\s*Share this episode with a friend[\s\S]*?<\/p>\s*/gi,
  /<(?:strong|b)>\s*Host\s*&(?:amp;)?\s*Show\s*Info\s*<\/(?:strong|b)>[\s\S]*?Share this episode with a friend[\s\S]*?<\/p>\s*/gi
];

const PLAIN_BLOCK_PATTERNS = [
  /Host\s*&(?:amp;)?\s*Show\s*Info[\s\S]*?Share this episode with a friend(?:\\!|!|\s*!)[\s\S]*?(?:favourite|favorite)\s+takeaway(?:\\\.|\.)/gi
];

function removeByPatterns(value, patterns) {
  if (typeof value !== 'string' || !value) return value;
  let next = value;
  for (const pattern of patterns) {
    next = next.replace(pattern, '\n');
  }
  next = next
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return next;
}

function cleanEpisodeFields(row) {
  const nextShowNotes = removeByPatterns(row.show_notes, HTML_BLOCK_PATTERNS);
  const nextDescriptionHtml = removeByPatterns(row.description_html, HTML_BLOCK_PATTERNS);
  const nextDescriptionPlain = removeByPatterns(row.description_plain, PLAIN_BLOCK_PATTERNS);

  const changes = {};
  if ((row.show_notes || '') !== (nextShowNotes || '')) changes.show_notes = nextShowNotes;
  if ((row.description_html || '') !== (nextDescriptionHtml || '')) changes.description_html = nextDescriptionHtml;
  if ((row.description_plain || '') !== (nextDescriptionPlain || '')) changes.description_plain = nextDescriptionPlain;
  return changes;
}

function cleanEditorialFields(row) {
  const nextBodyMarkdown = removeByPatterns(row.body_markdown, MARKDOWN_BLOCK_PATTERNS);
  const { bodyJson: nextBodyJson, changed: bodyJsonChanged } = cleanEditorialBodyJson(row.body_json);
  const changes = {};
  if ((row.body_markdown || '') !== (nextBodyMarkdown || '')) changes.body_markdown = nextBodyMarkdown;
  if (bodyJsonChanged) changes.body_json = nextBodyJson;
  return changes;
}

function inlineNodesToText(nodes) {
  if (!Array.isArray(nodes)) return '';
  return nodes
    .map((node) => {
      if (!node || typeof node !== 'object') return '';
      if (node.type === 'text') return `${node.text || ''}`;
      if (node.type === 'hard_break') return '\n';
      return '';
    })
    .join('');
}

function blockToText(block) {
  if (!block || typeof block !== 'object') return '';
  if (block.type === 'paragraph' || block.type === 'heading' || block.type === 'transcript') {
    return inlineNodesToText(block.content);
  }
  if (block.type === 'list') {
    return Array.isArray(block.items) ? block.items.map((item) => inlineNodesToText(item.content)).join('\n') : '';
  }
  if (block.type === 'blockquote') return inlineNodesToText(block.quote);
  if (block.type === 'table') {
    const headers = Array.isArray(block.headers) ? block.headers.join(' ') : '';
    const rows = Array.isArray(block.rows) ? block.rows.flat().join(' ') : '';
    return `${headers}\n${rows}`.trim();
  }
  if (block.type === 'code_block') return `${block.code || ''}`;
  if (block.type === 'listen_episode' || block.type === 'resources' || block.type === 'related_episodes' || block.type === 'related_posts' || block.type === 'faq') {
    return `${block.heading || ''}`;
  }
  return '';
}

const BODY_JSON_START_PATTERN = /Host\s*&\s*Show\s*Info/i;
const BODY_JSON_END_PATTERN = /Share\s*this\s*episode\s*with\s*a\s*friend/i;

function cleanEditorialBodyJson(bodyJson) {
  if (!Array.isArray(bodyJson) || !bodyJson.length) return { bodyJson, changed: false };

  const blocks = bodyJson;
  let startIndex = -1;
  let endIndex = -1;
  for (let i = 0; i < blocks.length; i += 1) {
    const text = normalizeForAudit(blockToText(blocks[i]));
    if (startIndex < 0 && BODY_JSON_START_PATTERN.test(text)) startIndex = i;
    if (startIndex >= 0 && BODY_JSON_END_PATTERN.test(text)) {
      endIndex = i;
      break;
    }
  }

  if (startIndex < 0) return { bodyJson, changed: false };
  if (endIndex < startIndex) endIndex = startIndex;

  const nextBodyJson = [...blocks.slice(0, startIndex), ...blocks.slice(endIndex + 1)];
  return { bodyJson: nextBodyJson, changed: nextBodyJson.length !== blocks.length };
}

function buildMarkdownSummary(report) {
  return [
    '# Episode Host/CTA Block Removal',
    '',
    `- Generated at: ${report.generated_at}`,
    `- Mode: ${report.mode}`,
    '',
    '## Totals',
    '',
    `- Episodes scanned: ${report.totals.episodes_scanned}`,
    `- Editorial rows scanned: ${report.totals.editorial_rows_scanned}`,
    `- Episodes changed: ${report.totals.episodes_changed}`,
    `- Editorial rows changed: ${report.totals.editorial_rows_changed}`,
    `- Total rows changed: ${report.totals.total_rows_changed}`,
    '',
    '## Verification',
    '',
    `- Episodes still containing the block: ${report.verification.episodes_with_block_remaining}`,
    `- Editorial rows still containing the block: ${report.verification.editorial_rows_with_block_remaining}`,
    `- Rows missing any required line after cleanup: ${report.verification.rows_missing_required_lines_after_cleanup}`,
    '',
    '## Paths',
    '',
    `- Before state: ${report.paths.before_state_json}`,
    `- CSV delta: ${report.paths.delta_csv}`,
    ''
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl = ensureEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = ensureEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.join(process.cwd(), 'tmp', 'taxonomy-audit', 'postdeploy', 'host-cta-removal');
  ensureDir(outDir);

  const [episodes, editorialRows] = await Promise.all([
    fetchAll(supabase, 'podcast_episodes', 'id,slug,title,show_notes,description_plain,description_html'),
    fetchAll(supabase, 'podcast_episode_editorial', 'id,episode_id,web_slug,web_title,body_markdown,body_json')
  ]);

  const changedEpisodes = [];
  const changedEditorialRows = [];

  for (const row of episodes) {
    const changes = cleanEpisodeFields(row);
    if (!Object.keys(changes).length) continue;
    changedEpisodes.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
      before: {
        show_notes: row.show_notes || '',
        description_plain: row.description_plain || '',
        description_html: row.description_html || ''
      },
      after: {
        show_notes: changes.show_notes ?? row.show_notes ?? '',
        description_plain: changes.description_plain ?? row.description_plain ?? '',
        description_html: changes.description_html ?? row.description_html ?? ''
      },
      changes
    });
  }

  for (const row of editorialRows) {
    const changes = cleanEditorialFields(row);
    if (!Object.keys(changes).length) continue;
    changedEditorialRows.push({
      id: row.id,
      episode_id: row.episode_id,
      web_slug: row.web_slug,
      web_title: row.web_title,
      before: {
        body_markdown: row.body_markdown || '',
        body_json: row.body_json ?? null
      },
      after: {
        body_markdown: changes.body_markdown ?? row.body_markdown ?? '',
        body_json: Object.prototype.hasOwnProperty.call(changes, 'body_json') ? changes.body_json : (row.body_json ?? null)
      },
      changes
    });
  }

  if (args.apply) {
    const nowIso = new Date().toISOString();
    for (const row of changedEpisodes) {
      const payload = { ...row.changes, updated_at: nowIso };
      const { error } = await supabase.from('podcast_episodes').update(payload).eq('id', row.id);
      if (error) throw new Error(`podcast_episodes ${row.id}: ${error.message}`);
    }
    for (const row of changedEditorialRows) {
      const payload = { ...row.changes, updated_at: nowIso };
      const { error } = await supabase.from('podcast_episode_editorial').update(payload).eq('id', row.id);
      if (error) throw new Error(`podcast_episode_editorial ${row.id}: ${error.message}`);
    }
  }

  // Post-change verification pass.
  const [verifyEpisodes, verifyEditorialRows] = args.apply
    ? await Promise.all([
        fetchAll(supabase, 'podcast_episodes', 'id,slug,title,show_notes,description_plain,description_html'),
        fetchAll(supabase, 'podcast_episode_editorial', 'id,episode_id,web_slug,web_title,body_markdown,body_json')
      ])
    : [episodes, editorialRows];

  let episodesWithBlockRemaining = 0;
  let editorialRowsWithBlockRemaining = 0;
  let rowsMissingRequiredLinesAfterCleanup = 0;

  for (const row of verifyEpisodes) {
    const combined = [row.show_notes, row.description_plain, row.description_html].filter((v) => typeof v === 'string' && v).join('\n\n');
    const missing = missingRequirements(combined);
    if (!missing.length) episodesWithBlockRemaining += 1;
    if (missing.length) rowsMissingRequiredLinesAfterCleanup += 1;
  }
  for (const row of verifyEditorialRows) {
    const markdownMissing = missingRequirements(row.body_markdown || '');
    const bodyJsonText = Array.isArray(row.body_json)
      ? row.body_json.map((block) => blockToText(block)).join('\n\n')
      : '';
    const bodyJsonMissing = missingRequirements(bodyJsonText);
    if (!markdownMissing.length || !bodyJsonMissing.length) editorialRowsWithBlockRemaining += 1;
    if ((row.body_markdown && markdownMissing.length) || (bodyJsonText && bodyJsonMissing.length)) rowsMissingRequiredLinesAfterCleanup += 1;
  }

  const beforeStatePath = path.join(outDir, `before-state-${timestamp}.json`);
  const deltaCsvPath = path.join(outDir, `delta-${timestamp}.csv`);
  const reportJsonPath = path.join(outDir, `report-${timestamp}.json`);
  const reportMdPath = path.join(outDir, `report-${timestamp}.md`);
  const latestReportPath = path.join(outDir, 'report.latest.json');

  const beforeState = {
    generated_at: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    changed_episodes: changedEpisodes,
    changed_editorial_rows: changedEditorialRows
  };
  writeJson(beforeStatePath, beforeState);

  const csvRows = [
    [
      'table',
      'id',
      'slug',
      'title',
      'field',
      'before_contains_host_block',
      'after_contains_host_block'
    ].join(',')
  ];

  for (const row of changedEpisodes) {
    for (const field of Object.keys(row.changes)) {
      const beforeValue = row.before[field] || '';
      const afterValue = row.after[field] || '';
      csvRows.push([
        'podcast_episodes',
        row.id,
        row.slug,
        row.title,
        field,
        missingRequirements(beforeValue).length === 0,
        missingRequirements(afterValue).length === 0
      ].map(toCsvValue).join(','));
    }
  }

  for (const row of changedEditorialRows) {
    for (const field of Object.keys(row.changes)) {
      const beforeValue = row.before[field] || '';
      const afterValue = row.after[field] || '';
      csvRows.push([
        'podcast_episode_editorial',
        row.id,
        row.web_slug || '',
        row.web_title || '',
        field,
        missingRequirements(beforeValue).length === 0,
        missingRequirements(afterValue).length === 0
      ].map(toCsvValue).join(','));
    }
  }
  writeText(deltaCsvPath, `${csvRows.join('\n')}\n`);

  const report = {
    generated_at: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    totals: {
      episodes_scanned: episodes.length,
      editorial_rows_scanned: editorialRows.length,
      episodes_changed: changedEpisodes.length,
      editorial_rows_changed: changedEditorialRows.length,
      total_rows_changed: changedEpisodes.length + changedEditorialRows.length
    },
    verification: {
      episodes_with_block_remaining: verifyEpisodes.filter((row) => missingRequirements([row.show_notes, row.description_plain, row.description_html].filter(Boolean).join('\n\n')).length === 0).length,
      editorial_rows_with_block_remaining: verifyEditorialRows.filter((row) => {
        const markdownHasBlock = missingRequirements(row.body_markdown || '').length === 0;
        const bodyJsonText = Array.isArray(row.body_json)
          ? row.body_json.map((block) => blockToText(block)).join('\n\n')
          : '';
        const bodyJsonHasBlock = missingRequirements(bodyJsonText).length === 0;
        return markdownHasBlock || bodyJsonHasBlock;
      }).length,
      rows_missing_required_lines_after_cleanup: rowsMissingRequiredLinesAfterCleanup
    },
    paths: {
      before_state_json: beforeStatePath,
      delta_csv: deltaCsvPath,
      report_json: reportJsonPath,
      report_md: reportMdPath
    }
  };

  writeJson(reportJsonPath, report);
  writeJson(latestReportPath, report);
  writeText(reportMdPath, buildMarkdownSummary(report));

  console.log(JSON.stringify(report, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
