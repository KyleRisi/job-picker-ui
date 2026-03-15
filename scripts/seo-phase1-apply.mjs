import { execSync } from 'node:child_process';
import path from 'node:path';
import {
  OUTPUT_ROOT,
  SELECTED_BLOG_PATHS,
  SELECTED_EPISODE_PATHS,
  SELECTED_HUB_PATHS,
  assertLockedScope,
  createSupabase,
  enforceOwnershipRules,
  loadCopydeck,
  markdownSummaryTable,
  normalizePath,
  parseArgs,
  resolveEnvConfig,
  shortText,
  writeJson,
  writeText
} from './seo-phase1-shared.mjs';

function parseHubRef(routePath) {
  const normalized = normalizePath(routePath);
  if (normalized.startsWith('/topics/')) return { term_type: 'topic', slug: normalized.slice('/topics/'.length), path: normalized };
  if (normalized.startsWith('/collections/')) return { term_type: 'collection', slug: normalized.slice('/collections/'.length), path: normalized };
  return null;
}

function getDeckHub(copydeck, pathValue) {
  return (copydeck.hub_terms || []).find((item) => normalizePath(item.path) === normalizePath(pathValue)) || null;
}

function getDeckEpisode(copydeck, pathValue) {
  return (copydeck.episodes || []).find((item) => normalizePath(item.path) === normalizePath(pathValue)) || null;
}

function getDeckBlog(copydeck, pathValue) {
  return (copydeck.blogs || []).find((item) => normalizePath(item.path) === normalizePath(pathValue)) || null;
}

function ensureSeoResourcesBlock(contentJson, linkRows) {
  const document = Array.isArray(contentJson) ? [...contentJson] : [];
  const markerId = 'seo-phase1-internal-links';
  const filtered = document.filter((block) => block?.id !== markerId);
  const items = linkRows.map((item, index) => ({
    id: `${markerId}-${index + 1}`,
    label: item.label,
    href: item.href,
    description: item.description
  }));
  if (items.length) {
    filtered.unshift({
      id: markerId,
      type: 'resources',
      heading: 'Explore Related Coverage',
      items
    });
  }
  return filtered;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.env) {
    throw new Error('Mutating command requires explicit --env (staging|production).');
  }
  const envName = args.env;
  const config = resolveEnvConfig(envName);
  const supabase = createSupabase(config);
  const copydeck = loadCopydeck();

  assertLockedScope(copydeck);
  const ownershipViolations = enforceOwnershipRules(copydeck);
  if (ownershipViolations.length) {
    throw new Error(`Ownership enforcement failed: ${ownershipViolations.join('; ')}`);
  }

  const rollbackStatePath = path.join(OUTPUT_ROOT, 'rollback', `${config.env}-before-state.json`);
  if (!args['skip-rollback-check']) {
    const fs = await import('node:fs');
    if (!fs.existsSync(rollbackStatePath)) {
      throw new Error(`Rollback artifact missing at ${rollbackStatePath}. Run rollback export first.`);
    }
  }

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

  const termByPath = new Map();
  for (const row of (terms || [])) {
    const pathValue = row.term_type === 'topic' ? `/topics/${row.slug}` : `/collections/${row.slug}`;
    termByPath.set(normalizePath(pathValue), row);
  }

  const episodeSlugs = SELECTED_EPISODE_PATHS.map((p) => p.slice('/episodes/'.length));
  const { data: episodes, error: episodesError } = await supabase
    .from('podcast_episodes')
    .select('id,slug,title')
    .in('slug', episodeSlugs);
  if (episodesError) throw episodesError;

  const episodeBySlug = new Map((episodes || []).map((item) => [item.slug, item]));
  const episodeByPath = new Map((episodes || []).map((item) => [`/episodes/${item.slug}`, item]));

  const blogSlugs = SELECTED_BLOG_PATHS.map((p) => p.slice('/blog/'.length));
  const { data: blogs, error: blogsError } = await supabase
    .from('blog_posts')
    .select('*')
    .in('slug', blogSlugs)
    .is('deleted_at', null);
  if (blogsError) throw blogsError;

  const blogByPath = new Map((blogs || []).map((item) => [`/blog/${item.slug}`, item]));
  const blogIds = (blogs || []).map((row) => row.id);

  const { data: existingBlogLinks, error: linksError } = await supabase
    .from('blog_post_discovery_terms')
    .select('*')
    .in('blog_post_id', blogIds);
  if (linksError) throw linksError;

  const { data: existingEpisodeLinks, error: episodeLinksError } = await supabase
    .from('blog_post_episode_links')
    .select('*')
    .in('post_id', blogIds);
  if (episodeLinksError) throw episodeLinksError;

  const beforeAfterRows = [];
  const counters = {
    applied: 0,
    skipped: 0,
    errors: 0
  };

  for (const pathValue of SELECTED_HUB_PATHS.filter((p) => p.startsWith('/topics/') || p.startsWith('/collections/'))) {
    const row = termByPath.get(pathValue);
    const deck = getDeckHub(copydeck, pathValue);
    if (!row || !deck) throw new Error(`Missing hub data for ${pathValue}`);

    const update = {
      seo_title: deck.seo.title,
      meta_description: deck.seo.description,
      description: deck.intro.description,
      intro_markdown: deck.intro.intro_markdown
    };

    const { error } = await supabase.from('discovery_terms').update(update).eq('id', row.id);
    if (error) throw error;
    counters.applied += 1;

    beforeAfterRows.push({ path: pathValue, type: 'hub', field: 'seo_title', before: shortText(row.seo_title), after: shortText(update.seo_title) });
    beforeAfterRows.push({ path: pathValue, type: 'hub', field: 'meta_description', before: shortText(row.meta_description), after: shortText(update.meta_description) });
    beforeAfterRows.push({ path: pathValue, type: 'hub', field: 'description', before: shortText(row.description), after: shortText(update.description) });
    beforeAfterRows.push({ path: pathValue, type: 'hub', field: 'intro_markdown', before: shortText(row.intro_markdown), after: shortText(update.intro_markdown) });
  }

  for (const pathValue of SELECTED_EPISODE_PATHS) {
    const deck = getDeckEpisode(copydeck, pathValue);
    const slug = pathValue.slice('/episodes/'.length);
    const episode = episodeBySlug.get(slug);
    if (!deck || !episode) throw new Error(`Missing episode data for ${pathValue}`);

    const payload = {
      episode_id: episode.id,
      seo_title: deck.seo.title,
      meta_description: deck.seo.description,
      excerpt: deck.summary.excerpt
    };

    const { error } = await supabase.from('podcast_episode_editorial').upsert(payload, { onConflict: 'episode_id' });
    if (error) throw error;
    counters.applied += 1;

    beforeAfterRows.push({ path: pathValue, type: 'episode', field: 'seo_title', before: '', after: shortText(payload.seo_title) });
    beforeAfterRows.push({ path: pathValue, type: 'episode', field: 'meta_description', before: '', after: shortText(payload.meta_description) });
    beforeAfterRows.push({ path: pathValue, type: 'episode', field: 'excerpt', before: '', after: shortText(payload.excerpt) });
  }

  const termLookup = new Map((terms || []).map((row) => {
    const p = row.term_type === 'topic' ? `/topics/${row.slug}` : `/collections/${row.slug}`;
    return [normalizePath(p), row];
  }));

  for (const pathValue of SELECTED_BLOG_PATHS) {
    const deck = getDeckBlog(copydeck, pathValue);
    const blog = blogByPath.get(pathValue);
    if (!deck || !blog) throw new Error(`Missing blog data for ${pathValue}`);

    const blogLinkSpecs = (copydeck.linking_updates || []).filter((link) => normalizePath(link.source_path) === pathValue);
    const linkRows = [];
    for (const link of blogLinkSpecs) {
      if (!link.editorial_relevance || !`${link.rationale || ''}`.trim()) continue;
      if (link.link_kind === 'blog_post_discovery_terms') {
        linkRows.push({ label: 'Explore topic hub', href: normalizePath(link.target_path), description: link.rationale });
      }
      if (link.link_kind === 'blog_post_episode_links') {
        linkRows.push({ label: 'Listen to the related episode', href: normalizePath(link.target_path), description: link.rationale });
      }
    }

    const nextContentJson = ensureSeoResourcesBlock(blog.content_json, linkRows);

    const { error } = await supabase
      .from('blog_posts')
      .update({
        seo_title: deck.seo.title,
        seo_description: deck.seo.description,
        excerpt: deck.intro.excerpt,
        content_json: nextContentJson
      })
      .eq('id', blog.id);
    if (error) throw error;
    counters.applied += 1;

    beforeAfterRows.push({ path: pathValue, type: 'blog', field: 'seo_title', before: shortText(blog.seo_title), after: shortText(deck.seo.title) });
    beforeAfterRows.push({ path: pathValue, type: 'blog', field: 'seo_description', before: shortText(blog.seo_description), after: shortText(deck.seo.description) });
    beforeAfterRows.push({ path: pathValue, type: 'blog', field: 'excerpt', before: shortText(blog.excerpt), after: shortText(deck.intro.excerpt) });

    const discoveryLinks = blogLinkSpecs.filter((item) => item.link_kind === 'blog_post_discovery_terms' && item.editorial_relevance);
    for (const item of discoveryLinks) {
      const targetTerm = termLookup.get(normalizePath(item.target_path));
      if (!targetTerm) continue;
      const exists = (existingBlogLinks || []).some((row) => row.blog_post_id === blog.id && row.term_id === targetTerm.id);
      if (!exists) {
        const { error: insertError } = await supabase
          .from('blog_post_discovery_terms')
          .insert({ blog_post_id: blog.id, term_id: targetTerm.id, is_primary: false, sort_order: 50 });
        if (insertError) throw insertError;
        counters.applied += 1;
      } else {
        counters.skipped += 1;
      }
    }

    const episodeLinks = blogLinkSpecs.filter((item) => item.link_kind === 'blog_post_episode_links' && item.editorial_relevance);
    for (const item of episodeLinks) {
      const targetEpisode = episodeByPath.get(normalizePath(item.target_path));
      if (!targetEpisode) continue;
      const exists = (existingEpisodeLinks || []).some((row) => row.post_id === blog.id && row.episode_id === targetEpisode.id);
      if (!exists) {
        const maxSort = Math.max(
          -1,
          ...(existingEpisodeLinks || []).filter((row) => row.post_id === blog.id).map((row) => Number(row.sort_order) || 0)
        );
        const { error: insertError } = await supabase
          .from('blog_post_episode_links')
          .insert({ post_id: blog.id, episode_id: targetEpisode.id, sort_order: maxSort + 1, is_primary: false });
        if (insertError) throw insertError;
        counters.applied += 1;
      } else {
        counters.skipped += 1;
      }
    }
  }

  const beforeAfterPath = path.join(OUTPUT_ROOT, `${config.env}-before-after.md`);
  const beforeAfterLines = [
    '# Staging Before/After Summary',
    '',
    `- Generated at: ${new Date().toISOString()}`,
    `- Env: ${config.env}`,
    '',
    '## Field-Level Changes',
    markdownSummaryTable(beforeAfterRows),
    ''
  ];
  writeText(beforeAfterPath, `${beforeAfterLines.join('\n')}\n`);

  const regressionDir = path.join(OUTPUT_ROOT, 'regression');
  let regressionStatus = 'not_run';
  let regressionOutput = '';
  try {
    regressionOutput = execSync(
      `node scripts/audit-taxonomy-seo-postdeploy.mjs --base ${JSON.stringify(config.baseUrl)} --out-dir ${JSON.stringify(regressionDir)}`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    regressionStatus = 'pass';
  } catch (error) {
    regressionOutput = `${error.stdout || ''}\n${error.stderr || ''}`.trim();
    regressionStatus = 'fail';
  }

  const applyReport = {
    generated_at: new Date().toISOString(),
    env: config.env,
    counters,
    applied_rows: beforeAfterRows.length,
    taxonomy_regression_guard: {
      status: regressionStatus,
      output_dir: regressionDir,
      output_excerpt: regressionOutput.split('\n').slice(-6)
    }
  };

  const applyReportPath = path.join(OUTPUT_ROOT, `${config.env}-apply-report.json`);
  writeJson(applyReportPath, applyReport);

  const previewPath = path.join(OUTPUT_ROOT, `${config.env}-preview-report.json`);
  try {
    const fs = await import('node:fs');
    if (fs.existsSync(previewPath)) {
      const preview = JSON.parse(fs.readFileSync(previewPath, 'utf8'));
      preview.gates = preview.gates || {};
      preview.gates.taxonomy_regression_guard = regressionStatus;
      preview.taxonomy_regression = {
        output_dir: regressionDir,
        apply_report: applyReportPath
      };
      writeJson(previewPath, preview);
    }
  } catch {
    // no-op
  }

  console.log(`Wrote before/after summary: ${beforeAfterPath}`);
  console.log(`Wrote apply report: ${applyReportPath}`);

  if (regressionStatus !== 'pass') {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
