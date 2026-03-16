import crypto from 'node:crypto';
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

function hasTranscriptBlock(value) {
  return Array.isArray(value) && value.some((block) => block && typeof block === 'object' && block.type === 'transcript');
}

function buildTranscriptBlock() {
  return {
    id: `transcript-auto-${crypto.randomUUID()}`,
    type: 'transcript',
    heading: 'Episode transcript',
    content: []
  };
}

function toMarkdown(report) {
  return [
    '# Episode Transcript Block Backfill',
    '',
    `- Generated at: ${report.generated_at}`,
    `- Mode: ${report.mode}`,
    '',
    '## Totals',
    '',
    `- Episodes scanned: ${report.totals.episodes_scanned}`,
    `- Existing editorial rows: ${report.totals.editorial_rows_scanned}`,
    `- Episodes already had transcript block: ${report.totals.already_had_transcript}`,
    `- Editorial rows updated: ${report.totals.updated_editorial_rows}`,
    `- Editorial rows created: ${report.totals.created_editorial_rows}`,
    `- Total changed rows: ${report.totals.total_changed_rows}`,
    '',
    '## Verification',
    '',
    `- Episodes missing transcript block after run: ${report.verification.episodes_missing_transcript_after_run}`,
    '',
    '## Paths',
    '',
    `- Before state: ${report.paths.before_state_json}`,
    `- Report JSON: ${report.paths.report_json}`,
    `- Report Markdown: ${report.paths.report_md}`,
    ''
  ].join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const supabaseUrl = ensureEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = ensureEnv('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const outDir = path.join(process.cwd(), 'tmp', 'taxonomy-audit', 'postdeploy', 'episode-transcript-backfill');
  ensureDir(outDir);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const [episodes, editorialRows] = await Promise.all([
    fetchAll(supabase, 'podcast_episodes', 'id,slug,title'),
    fetchAll(supabase, 'podcast_episode_editorial', 'id,episode_id,web_slug,web_title,body_json')
  ]);

  const editorialByEpisodeId = new Map(editorialRows.map((row) => [row.episode_id, row]));
  const updates = [];
  const creates = [];
  let alreadyHadTranscript = 0;

  for (const episode of episodes) {
    const editorial = editorialByEpisodeId.get(episode.id);
    if (editorial) {
      const doc = Array.isArray(editorial.body_json) ? editorial.body_json : [];
      if (hasTranscriptBlock(doc)) {
        alreadyHadTranscript += 1;
        continue;
      }
      updates.push({
        id: editorial.id,
        episode_id: episode.id,
        slug: episode.slug,
        title: episode.title,
        before_body_json: editorial.body_json ?? null,
        after_body_json: [...doc, buildTranscriptBlock()]
      });
      continue;
    }

    creates.push({
      episode_id: episode.id,
      slug: episode.slug,
      title: episode.title,
      body_json: [buildTranscriptBlock()]
    });
  }

  if (args.apply) {
    const nowIso = new Date().toISOString();
    for (const row of updates) {
      const { error } = await supabase
        .from('podcast_episode_editorial')
        .update({
          body_json: row.after_body_json,
          updated_at: nowIso
        })
        .eq('id', row.id);
      if (error) throw new Error(`podcast_episode_editorial update ${row.id}: ${error.message}`);
    }

    if (creates.length) {
      const payload = creates.map((row) => ({
        episode_id: row.episode_id,
        body_json: row.body_json
      }));
      const { error } = await supabase.from('podcast_episode_editorial').upsert(payload, { onConflict: 'episode_id' });
      if (error) throw new Error(`podcast_episode_editorial create: ${error.message}`);
    }
  }

  const verifyRows = args.apply
    ? await fetchAll(supabase, 'podcast_episode_editorial', 'episode_id,body_json')
    : editorialRows.map((row) => {
        const pendingUpdate = updates.find((item) => item.episode_id === row.episode_id);
        return {
          episode_id: row.episode_id,
          body_json: pendingUpdate ? pendingUpdate.after_body_json : row.body_json
        };
      }).concat(creates.map((row) => ({ episode_id: row.episode_id, body_json: row.body_json })));

  const verifyByEpisodeId = new Map(verifyRows.map((row) => [row.episode_id, row]));
  const episodesMissingTranscript = [];
  for (const episode of episodes) {
    const row = verifyByEpisodeId.get(episode.id);
    if (!row || !hasTranscriptBlock(row.body_json)) {
      episodesMissingTranscript.push({
        episode_id: episode.id,
        slug: episode.slug,
        title: episode.title
      });
    }
  }

  const beforeStatePath = path.join(outDir, `before-state-${timestamp}.json`);
  const reportJsonPath = path.join(outDir, `report-${timestamp}.json`);
  const reportMdPath = path.join(outDir, `report-${timestamp}.md`);
  const latestPath = path.join(outDir, 'report.latest.json');

  const beforeState = {
    generated_at: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    updates,
    creates
  };
  writeJson(beforeStatePath, beforeState);

  const report = {
    generated_at: new Date().toISOString(),
    mode: args.apply ? 'apply' : 'dry-run',
    totals: {
      episodes_scanned: episodes.length,
      editorial_rows_scanned: editorialRows.length,
      already_had_transcript: alreadyHadTranscript,
      updated_editorial_rows: updates.length,
      created_editorial_rows: creates.length,
      total_changed_rows: updates.length + creates.length
    },
    verification: {
      episodes_missing_transcript_after_run: episodesMissingTranscript.length
    },
    paths: {
      before_state_json: beforeStatePath,
      report_json: reportJsonPath,
      report_md: reportMdPath
    },
    missing_episodes: episodesMissingTranscript
  };

  writeJson(reportJsonPath, report);
  writeJson(latestPath, report);
  writeText(reportMdPath, toMarkdown(report));

  console.log(JSON.stringify(report, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
