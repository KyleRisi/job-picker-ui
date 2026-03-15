import fs from 'node:fs';
import path from 'node:path';
import {
  OUTPUT_ROOT,
  createSupabase,
  parseArgs,
  resolveEnvConfig,
  writeJson
} from './seo-phase1-shared.mjs';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.env) {
    throw new Error('Mutating command requires explicit --env (staging|production).');
  }
  const envName = args.env;
  const sourcePath = args.source
    ? path.isAbsolute(args.source)
      ? args.source
      : path.join(process.cwd(), args.source)
    : path.join(OUTPUT_ROOT, 'rollback', `${envName}-restore.json`);

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Restore payload not found at ${sourcePath}`);
  }

  const payload = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const restore = payload.restore || payload;
  const config = resolveEnvConfig(envName);
  const supabase = createSupabase(config);

  let updated = 0;

  for (const row of restore.discovery_terms || []) {
    const { error } = await supabase
      .from('discovery_terms')
      .update({
        seo_title: row.seo_title,
        meta_description: row.meta_description,
        description: row.description,
        intro_markdown: row.intro_markdown
      })
      .eq('id', row.id);
    if (error) throw error;
    updated += 1;
  }

  for (const row of restore.podcast_episode_editorial || []) {
    const { error } = await supabase
      .from('podcast_episode_editorial')
      .upsert({
        episode_id: row.episode_id,
        seo_title: row.seo_title,
        meta_description: row.meta_description,
        excerpt: row.excerpt
      }, { onConflict: 'episode_id' });
    if (error) throw error;
    updated += 1;
  }

  const selectedEpisodeIds = (restore.podcast_episodes || []).map((row) => row.id);
  const beforeEpisodeIdsWithEditorial = new Set((restore.podcast_episode_editorial || []).map((row) => row.episode_id));
  if (selectedEpisodeIds.length) {
    const { data: currentEditorial, error: currentEditorialError } = await supabase
      .from('podcast_episode_editorial')
      .select('episode_id')
      .in('episode_id', selectedEpisodeIds);
    if (currentEditorialError) throw currentEditorialError;

    const extraEpisodeIds = (currentEditorial || [])
      .map((row) => row.episode_id)
      .filter((episodeId) => !beforeEpisodeIdsWithEditorial.has(episodeId));

    if (extraEpisodeIds.length) {
      const { error: deleteExtraError } = await supabase
        .from('podcast_episode_editorial')
        .delete()
        .in('episode_id', extraEpisodeIds);
      if (deleteExtraError) throw deleteExtraError;
    }
  }

  for (const row of restore.blog_posts || []) {
    const { error } = await supabase
      .from('blog_posts')
      .update({
        seo_title: row.seo_title,
        seo_description: row.seo_description,
        excerpt: row.excerpt,
        content_json: row.content_json
      })
      .eq('id', row.id);
    if (error) throw error;
    updated += 1;
  }

  const blogIds = (restore.blog_posts || []).map((row) => row.id);
  if (blogIds.length) {
    const { error: clearDiscoveryError } = await supabase
      .from('blog_post_discovery_terms')
      .delete()
      .in('blog_post_id', blogIds);
    if (clearDiscoveryError) throw clearDiscoveryError;

    if ((restore.blog_post_discovery_terms || []).length) {
      const { error: insertDiscoveryError } = await supabase
        .from('blog_post_discovery_terms')
        .insert(restore.blog_post_discovery_terms);
      if (insertDiscoveryError) throw insertDiscoveryError;
    }

    const { error: clearEpisodeLinksError } = await supabase
      .from('blog_post_episode_links')
      .delete()
      .in('post_id', blogIds);
    if (clearEpisodeLinksError) throw clearEpisodeLinksError;

    if ((restore.blog_post_episode_links || []).length) {
      const { error: insertEpisodeLinksError } = await supabase
        .from('blog_post_episode_links')
        .insert(restore.blog_post_episode_links);
      if (insertEpisodeLinksError) throw insertEpisodeLinksError;
    }
  }

  const out = {
    restored_at: new Date().toISOString(),
    env: config.env,
    source: sourcePath,
    updated_rows: updated,
    restored_blog_ids: blogIds.length
  };

  const outPath = path.join(OUTPUT_ROOT, 'rollback', `${config.env}-restore-result.json`);
  writeJson(outPath, out);
  console.log(`Wrote restore result: ${outPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
