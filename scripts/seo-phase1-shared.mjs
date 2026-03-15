import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

export const COPYDECK_PATH = path.join(process.cwd(), 'tmp', 'seo-phase1', 'phase1-copydeck.v1.json');
export const OUTPUT_ROOT = path.join(process.cwd(), 'tmp', 'seo-phase1');

export const SELECTED_HUB_PATHS = [
  '/topics',
  '/topics/true-crime',
  '/topics/history',
  '/topics/incredible-people',
  '/topics/scams-hoaxes-cons',
  '/topics/mysteries-unexplained',
  '/topics/pop-culture-entertainment',
  '/topics/cults-belief-moral-panics',
  '/topics/disasters-survival',
  '/collections',
  '/collections/british-cases'
];

export const SELECTED_EPISODE_PATHS = [
  '/episodes/sex-cult-the-story-of-bhagwan-rajneesh-and-his-sex-cult-s-bioterror-plot-to-take-over-oregon',
  '/episodes/survival-at-sea-the-harrowing-tale-of-the-trashman-yacht-sinking',
  '/episodes/sixto-rodriguez-the-story-of-an-unknown-musician-who-inspired-a-revolution',
  '/episodes/nutty-putty-cave-the-john-edward-jones-story-that-haunts-cavers-to-this-day',
  '/episodes/jennifer-fairgate-the-woman-with-no-past',
  '/episodes/body-in-room-348-how-a-locked-room-led-to-an-impossible-answer',
  '/episodes/nuns-on-the-run-how-eight-belgian-nuns-outsmarted-the-church',
  '/episodes/the-suffolk-strangler-steve-wright-the-man-who-made-the-road-home-a-nightmare',
  '/episodes/the-great-emu-war-of-1932-emus-soldiers-and-an-unexpected-war'
];

export const SELECTED_BLOG_PATHS = [
  '/blog/the-jennifer-fairgate-mystery',
  '/blog/lucy-letby-what-really-happened',
  '/blog/nellie-bly-10-days-in-a-mad-house-to-72-days-around-the-world'
];

export function normalizePath(input) {
  const raw = `${input || ''}`.trim();
  if (!raw) return '/';
  let value = raw;
  if (!value.startsWith('/')) value = `/${value}`;
  const [pathname] = value.split('?');
  const compact = pathname.replace(/\/+/g, '/');
  if (compact === '/') return '/';
  return compact.replace(/\/+$/, '').toLowerCase() || '/';
}

export function pathToSlug(routePath) {
  return normalizePath(routePath).split('/').filter(Boolean).slice(1).join('/');
}

export function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    if (next && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = 'true';
    }
  }
  return args;
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeJson(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export function writeText(filePath, value) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value);
}

export function loadCopydeck() {
  if (!fs.existsSync(COPYDECK_PATH)) {
    throw new Error(`Copy deck not found at ${COPYDECK_PATH}`);
  }
  return JSON.parse(fs.readFileSync(COPYDECK_PATH, 'utf8'));
}

export function resolveEnvConfig(envName = 'staging') {
  const normalized = `${envName || 'staging'}`.trim().toLowerCase();
  if (normalized === 'production') {
    const rawBase = `${process.env.APP_BASE_URL || ''}`.trim();
    const normalizedBase = (!rawBase || /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(rawBase))
      ? 'https://www.thecompendiumpodcast.com'
      : rawBase;
    return {
      env: 'production',
      supabaseUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}`.trim(),
      supabaseKey: `${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`.trim(),
      baseUrl: normalizedBase
    };
  }

  return {
    env: 'staging',
    supabaseUrl: `${process.env.STAGING_SUPABASE_URL || ''}`.trim(),
    supabaseKey: `${process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY || ''}`.trim(),
    baseUrl: `${process.env.STAGING_APP_BASE_URL || ''}`.trim()
  };
}

export function createSupabase(config) {
  if (!config.supabaseUrl || !config.supabaseKey) {
    throw new Error(`Missing Supabase credentials for env=${config.env}.`);
  }
  if (config.env === 'staging' && !config.baseUrl) {
    throw new Error('Missing STAGING_APP_BASE_URL for env=staging.');
  }
  return createClient(config.supabaseUrl, config.supabaseKey, { auth: { persistSession: false } });
}

export function assertLockedScope(copydeck) {
  const selectedHubSet = new Set(SELECTED_HUB_PATHS.map(normalizePath));
  const selectedEpisodeSet = new Set(SELECTED_EPISODE_PATHS.map(normalizePath));
  const selectedBlogSet = new Set(SELECTED_BLOG_PATHS.map(normalizePath));

  const deckHubSet = new Set([
    ...(copydeck.static_pages || []).map((item) => normalizePath(item.path)).filter((p) => p === '/topics' || p === '/collections'),
    ...(copydeck.hub_terms || []).map((item) => normalizePath(item.path))
  ]);
  const deckEpisodeSet = new Set((copydeck.episodes || []).map((item) => normalizePath(item.path)));
  const deckBlogSet = new Set((copydeck.blogs || []).map((item) => normalizePath(item.path)));

  const missing = [];
  for (const p of selectedHubSet) if (!deckHubSet.has(p)) missing.push(`missing_hub:${p}`);
  for (const p of selectedEpisodeSet) if (!deckEpisodeSet.has(p)) missing.push(`missing_episode:${p}`);
  for (const p of selectedBlogSet) if (!deckBlogSet.has(p)) missing.push(`missing_blog:${p}`);

  const extras = [];
  for (const p of deckHubSet) if (!selectedHubSet.has(p)) extras.push(`extra_hub:${p}`);
  for (const p of deckEpisodeSet) if (!selectedEpisodeSet.has(p)) extras.push(`extra_episode:${p}`);
  for (const p of deckBlogSet) if (!selectedBlogSet.has(p)) extras.push(`extra_blog:${p}`);

  if (missing.length || extras.length) {
    throw new Error(`Copydeck scope mismatch: ${[...missing, ...extras].join(', ')}`);
  }
}

export function enforceOwnershipRules(copydeck) {
  const violations = [];

  for (const hub of copydeck.hub_terms || []) {
    if (hub.ownership?.page_role !== 'hub') violations.push(`${hub.path}:hub role invalid`);
    if (hub.ownership?.search_intent !== 'broad topical discovery') violations.push(`${hub.path}:hub intent invalid`);
  }

  for (const episode of copydeck.episodes || []) {
    if (episode.ownership?.page_role !== 'episode') violations.push(`${episode.path}:episode role invalid`);
    if (episode.ownership?.search_intent !== 'podcast listen/story intent') violations.push(`${episode.path}:episode intent invalid`);
  }

  for (const blog of copydeck.blogs || []) {
    if (blog.ownership?.page_role !== 'blog') violations.push(`${blog.path}:blog role invalid`);
    if (blog.ownership?.search_intent !== 'informational/entity intent') violations.push(`${blog.path}:blog intent invalid`);
  }

  for (const link of copydeck.linking_updates || []) {
    if (!link.editorial_relevance || !`${link.rationale || ''}`.trim()) {
      violations.push(`link:${link.source_path}->${link.target_path}:missing editorial relevance or rationale`);
    }
  }

  return violations;
}

export function sqlLiteral(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? `${value}` : 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return `'${`${value}`.replace(/'/g, "''")}'`;
}

export function markdownSummaryTable(rows) {
  const header = '| Path | Type | Field | Before | After |';
  const divider = '| --- | --- | --- | --- | --- |';
  const lines = [header, divider];
  for (const row of rows) {
    lines.push(`| ${row.path} | ${row.type} | ${row.field} | ${row.before || ''} | ${row.after || ''} |`);
  }
  return lines.join('\n');
}

export function shortText(value, limit = 120) {
  const normalized = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 3)}...`;
}
