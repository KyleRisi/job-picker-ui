import path from 'node:path';
import {
  OUTPUT_ROOT,
  SELECTED_BLOG_PATHS,
  SELECTED_EPISODE_PATHS,
  SELECTED_HUB_PATHS,
  createSupabase,
  loadCopydeck,
  normalizePath,
  parseArgs,
  resolveEnvConfig,
  sqlLiteral,
  writeJson,
  writeText
} from './seo-phase1-shared.mjs';

function parseHubRef(routePath) {
  const normalized = normalizePath(routePath);
  if (normalized.startsWith('/topics/')) return { term_type: 'topic', slug: normalized.slice('/topics/'.length) };
  if (normalized.startsWith('/collections/')) return { term_type: 'collection', slug: normalized.slice('/collections/'.length) };
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envName = args.env || 'staging';
  const config = resolveEnvConfig(envName);
  const supabase = createSupabase(config);
  const copydeck = loadCopydeck();

  const hubRefs = SELECTED_HUB_PATHS
    .filter((p) => p.startsWith('/topics/') || p.startsWith('/collections/'))
    .map(parseHubRef)
    .filter(Boolean);

  const { data: terms, error: termsError } = await supabase
    .from('discovery_terms')
    .select('*')
    .in('slug', hubRefs.map((item) => item.slug))
    .in('term_type', [...new Set(hubRefs.map((item) => item.term_type))]);
  if (termsError) throw termsError;

  const episodeSlugs = SELECTED_EPISODE_PATHS.map((p) => p.slice('/episodes/'.length));
  const { data: episodes, error: episodesError } = await supabase
    .from('podcast_episodes')
    .select('id,slug,title')
    .in('slug', episodeSlugs);
  if (episodesError) throw episodesError;

  const episodeIds = (episodes || []).map((row) => row.id);
  const { data: editorialRows, error: editorialError } = await supabase
    .from('podcast_episode_editorial')
    .select('*')
    .in('episode_id', episodeIds);
  if (editorialError) throw editorialError;

  const blogSlugs = SELECTED_BLOG_PATHS.map((p) => p.slice('/blog/'.length));
  const { data: blogs, error: blogError } = await supabase
    .from('blog_posts')
    .select('*')
    .in('slug', blogSlugs)
    .is('deleted_at', null);
  if (blogError) throw blogError;

  const blogIds = (blogs || []).map((row) => row.id);
  const [blogDiscovery, blogEpisodeLinks] = await Promise.all([
    supabase
      .from('blog_post_discovery_terms')
      .select('*')
      .in('blog_post_id', blogIds),
    supabase
      .from('blog_post_episode_links')
      .select('*')
      .in('post_id', blogIds)
  ]);

  if (blogDiscovery.error) throw blogDiscovery.error;
  if (blogEpisodeLinks.error) throw blogEpisodeLinks.error;

  const beforeState = {
    generated_at: new Date().toISOString(),
    env: config.env,
    copydeck_version: copydeck.version,
    selected_scope: {
      hubs: SELECTED_HUB_PATHS,
      episodes: SELECTED_EPISODE_PATHS,
      blogs: SELECTED_BLOG_PATHS
    },
    discovery_terms: terms || [],
    podcast_episodes: episodes || [],
    podcast_episode_editorial: editorialRows || [],
    blog_posts: blogs || [],
    blog_post_discovery_terms: blogDiscovery.data || [],
    blog_post_episode_links: blogEpisodeLinks.data || []
  };

  const rollbackDir = path.join(OUTPUT_ROOT, 'rollback');
  const beforeJsonPath = path.join(rollbackDir, `${config.env}-before-state.json`);
  writeJson(beforeJsonPath, beforeState);

  const restorePayloadPath = path.join(rollbackDir, `${config.env}-restore.json`);
  writeJson(restorePayloadPath, {
    generated_at: beforeState.generated_at,
    env: config.env,
    restore: beforeState
  });

  const sqlLines = [];
  sqlLines.push('begin;');

  for (const row of beforeState.discovery_terms) {
    sqlLines.push(
      `update discovery_terms set seo_title = ${sqlLiteral(row.seo_title)}, meta_description = ${sqlLiteral(row.meta_description)}, description = ${sqlLiteral(row.description)}, intro_markdown = ${sqlLiteral(row.intro_markdown)} where id = ${sqlLiteral(row.id)};`
    );
  }

  const editorialByEpisode = new Map(beforeState.podcast_episode_editorial.map((row) => [row.episode_id, row]));
  for (const episode of beforeState.podcast_episodes) {
    const row = editorialByEpisode.get(episode.id);
    if (!row) continue;
    sqlLines.push(
      `update podcast_episode_editorial set seo_title = ${sqlLiteral(row.seo_title)}, meta_description = ${sqlLiteral(row.meta_description)}, excerpt = ${sqlLiteral(row.excerpt)} where episode_id = ${sqlLiteral(row.episode_id)};`
    );
  }

  for (const row of beforeState.blog_posts) {
    sqlLines.push(
      `update blog_posts set seo_title = ${sqlLiteral(row.seo_title)}, seo_description = ${sqlLiteral(row.seo_description)}, excerpt = ${sqlLiteral(row.excerpt)}, content_json = ${sqlLiteral(JSON.stringify(row.content_json))}::jsonb where id = ${sqlLiteral(row.id)};`
    );
  }

  if (beforeState.blog_posts.length) {
    const blogIdsSql = beforeState.blog_posts.map((row) => sqlLiteral(row.id)).join(', ');
    sqlLines.push(`delete from blog_post_discovery_terms where blog_post_id in (${blogIdsSql});`);
    for (const row of beforeState.blog_post_discovery_terms) {
      sqlLines.push(
        `insert into blog_post_discovery_terms (blog_post_id, term_id, is_primary, sort_order) values (${sqlLiteral(row.blog_post_id)}, ${sqlLiteral(row.term_id)}, ${sqlLiteral(row.is_primary)}, ${sqlLiteral(row.sort_order)});`
      );
    }

    sqlLines.push(`delete from blog_post_episode_links where post_id in (${blogIdsSql});`);
    for (const row of beforeState.blog_post_episode_links) {
      sqlLines.push(
        `insert into blog_post_episode_links (post_id, episode_id, sort_order, is_primary) values (${sqlLiteral(row.post_id)}, ${sqlLiteral(row.episode_id)}, ${sqlLiteral(row.sort_order)}, ${sqlLiteral(row.is_primary)});`
      );
    }
  }

  sqlLines.push('commit;');

  const restoreSqlPath = path.join(rollbackDir, `${config.env}-restore.sql`);
  writeText(restoreSqlPath, `${sqlLines.join('\n')}\n`);

  console.log(`Wrote before-state: ${beforeJsonPath}`);
  console.log(`Wrote restore payload: ${restorePayloadPath}`);
  console.log(`Wrote restore SQL: ${restoreSqlPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
