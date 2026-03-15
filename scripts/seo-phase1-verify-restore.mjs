import fs from 'node:fs';
import path from 'node:path';
import {
  OUTPUT_ROOT,
  createSupabase,
  parseArgs,
  resolveEnvConfig,
  writeJson
} from './seo-phase1-shared.mjs';

function sortByKey(rows, key) {
  return [...(rows || [])].sort((a, b) => `${a[key]}`.localeCompare(`${b[key]}`));
}

function equalJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function pickDiscoveryFields(rows) {
  return (rows || []).map((row) => ({
    id: row.id,
    seo_title: row.seo_title,
    meta_description: row.meta_description,
    description: row.description,
    intro_markdown: row.intro_markdown
  }));
}

function pickEditorialFields(rows) {
  return (rows || []).map((row) => ({
    episode_id: row.episode_id,
    seo_title: row.seo_title,
    meta_description: row.meta_description,
    excerpt: row.excerpt
  }));
}

function pickBlogFields(rows) {
  return (rows || []).map((row) => ({
    id: row.id,
    seo_title: row.seo_title,
    seo_description: row.seo_description,
    excerpt: row.excerpt,
    content_json: row.content_json
  }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envName = args.env || 'staging';
  const config = resolveEnvConfig(envName);
  const supabase = createSupabase(config);

  const beforePath = args.before
    ? (path.isAbsolute(args.before) ? args.before : path.join(process.cwd(), args.before))
    : path.join(OUTPUT_ROOT, 'rollback', `${config.env}-before-state.json`);

  if (!fs.existsSync(beforePath)) {
    throw new Error(`Before-state file missing at ${beforePath}`);
  }

  const before = JSON.parse(fs.readFileSync(beforePath, 'utf8'));

  const termIds = (before.discovery_terms || []).map((row) => row.id);
  const episodeIds = (before.podcast_episodes || []).map((row) => row.id);
  const blogIds = (before.blog_posts || []).map((row) => row.id);

  const [termsRes, editorialRes, blogsRes, blogDiscoveryRes, blogEpisodeLinksRes] = await Promise.all([
    supabase.from('discovery_terms').select('*').in('id', termIds),
    supabase.from('podcast_episode_editorial').select('*').in('episode_id', episodeIds),
    supabase.from('blog_posts').select('*').in('id', blogIds),
    supabase.from('blog_post_discovery_terms').select('*').in('blog_post_id', blogIds),
    supabase.from('blog_post_episode_links').select('*').in('post_id', blogIds)
  ]);

  if (termsRes.error) throw termsRes.error;
  if (editorialRes.error) throw editorialRes.error;
  if (blogsRes.error) throw blogsRes.error;
  if (blogDiscoveryRes.error) throw blogDiscoveryRes.error;
  if (blogEpisodeLinksRes.error) throw blogEpisodeLinksRes.error;

  const mismatches = [];

  const termsBefore = sortByKey(pickDiscoveryFields(before.discovery_terms || []), 'id');
  const termsNow = sortByKey(pickDiscoveryFields(termsRes.data || []), 'id');
  if (!equalJson(termsBefore, termsNow)) mismatches.push('discovery_terms mismatch');

  const editorialBefore = sortByKey(pickEditorialFields(before.podcast_episode_editorial || []), 'episode_id');
  const editorialNow = sortByKey(pickEditorialFields(editorialRes.data || []), 'episode_id');
  if (!equalJson(editorialBefore, editorialNow)) mismatches.push('podcast_episode_editorial mismatch');

  const blogsBefore = sortByKey(pickBlogFields(before.blog_posts || []), 'id');
  const blogsNow = sortByKey(pickBlogFields(blogsRes.data || []), 'id');
  if (!equalJson(blogsBefore, blogsNow)) mismatches.push('blog_posts mismatch');

  const blogDiscoveryBefore = sortByKey(before.blog_post_discovery_terms || [], 'blog_post_id');
  const blogDiscoveryNow = sortByKey(blogDiscoveryRes.data || [], 'blog_post_id');
  if (!equalJson(blogDiscoveryBefore, blogDiscoveryNow)) mismatches.push('blog_post_discovery_terms mismatch');

  const blogEpisodeBefore = sortByKey(before.blog_post_episode_links || [], 'post_id');
  const blogEpisodeNow = sortByKey(blogEpisodeLinksRes.data || [], 'post_id');
  if (!equalJson(blogEpisodeBefore, blogEpisodeNow)) mismatches.push('blog_post_episode_links mismatch');

  const result = {
    verified_at: new Date().toISOString(),
    env: config.env,
    before_state_path: beforePath,
    mismatch_count: mismatches.length,
    mismatches,
    pass: mismatches.length === 0
  };

  const outPath = path.join(OUTPUT_ROOT, 'rollback', `${config.env}-restore-verify.json`);
  writeJson(outPath, result);
  console.log(`Wrote restore verification: ${outPath}`);

  if (!result.pass) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
