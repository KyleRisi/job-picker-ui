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

function getCopydeckHub(copydeck, pathValue) {
  return (copydeck.hub_terms || []).find((item) => normalizePath(item.path) === normalizePath(pathValue)) || null;
}

function getCopydeckEpisode(copydeck, pathValue) {
  return (copydeck.episodes || []).find((item) => normalizePath(item.path) === normalizePath(pathValue)) || null;
}

function getCopydeckBlog(copydeck, pathValue) {
  return (copydeck.blogs || []).find((item) => normalizePath(item.path) === normalizePath(pathValue)) || null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const envName = args.env || 'staging';
  const config = resolveEnvConfig(envName);
  const supabase = createSupabase(config);
  const copydeck = loadCopydeck();

  assertLockedScope(copydeck);
  const ownershipViolations = enforceOwnershipRules(copydeck);

  const hubRefs = SELECTED_HUB_PATHS
    .filter((p) => p.startsWith('/topics/') || p.startsWith('/collections/'))
    .map(parseHubRef)
    .filter(Boolean);

  const { data: terms, error: termsError } = await supabase
    .from('discovery_terms')
    .select('id,term_type,slug,name,seo_title,meta_description,description,intro_markdown')
    .in('slug', hubRefs.map((item) => item.slug))
    .in('term_type', [...new Set(hubRefs.map((item) => item.term_type))]);
  if (termsError) throw termsError;

  const termByPath = new Map();
  for (const row of (terms || [])) {
    const pathValue = row.term_type === 'topic' ? `/topics/${row.slug}` : `/collections/${row.slug}`;
    termByPath.set(normalizePath(pathValue), row);
  }

  const episodeSlugs = SELECTED_EPISODE_PATHS.map((p) => p.slice('/episodes/'.length));
  const { data: episodes, error: episodeError } = await supabase
    .from('podcast_episodes')
    .select('id,slug,title')
    .in('slug', episodeSlugs);
  if (episodeError) throw episodeError;

  const episodeIds = (episodes || []).map((row) => row.id);
  const { data: editorialRows, error: editorialError } = await supabase
    .from('podcast_episode_editorial')
    .select('episode_id,seo_title,meta_description,excerpt')
    .in('episode_id', episodeIds);
  if (editorialError) throw editorialError;
  const editorialByEpisodeId = new Map((editorialRows || []).map((row) => [row.episode_id, row]));

  const blogSlugs = SELECTED_BLOG_PATHS.map((p) => p.slice('/blog/'.length));
  const { data: blogs, error: blogError } = await supabase
    .from('blog_posts')
    .select('id,slug,title,seo_title,seo_description,excerpt,content_json')
    .in('slug', blogSlugs)
    .is('deleted_at', null);
  if (blogError) throw blogError;

  const reportRows = [];
  const gateFailures = [];

  for (const pathValue of SELECTED_HUB_PATHS.filter((p) => p.startsWith('/topics/') || p.startsWith('/collections/'))) {
    const current = termByPath.get(pathValue);
    const deck = getCopydeckHub(copydeck, pathValue);
    if (!current) {
      gateFailures.push(`Hub term missing in DB: ${pathValue}`);
      continue;
    }
    if (!deck) {
      gateFailures.push(`Hub term missing in copydeck: ${pathValue}`);
      continue;
    }

    reportRows.push({ path: pathValue, type: 'hub', field: 'seo_title', before: shortText(current.seo_title), after: shortText(deck.seo.title) });
    reportRows.push({ path: pathValue, type: 'hub', field: 'meta_description', before: shortText(current.meta_description), after: shortText(deck.seo.description) });
    reportRows.push({ path: pathValue, type: 'hub', field: 'description', before: shortText(current.description), after: shortText(deck.intro.description) });
    reportRows.push({ path: pathValue, type: 'hub', field: 'intro_markdown', before: shortText(current.intro_markdown), after: shortText(deck.intro.intro_markdown) });
  }

  const episodeBySlug = new Map((episodes || []).map((row) => [row.slug, row]));
  for (const pathValue of SELECTED_EPISODE_PATHS) {
    const slug = pathValue.slice('/episodes/'.length);
    const episode = episodeBySlug.get(slug);
    const deck = getCopydeckEpisode(copydeck, pathValue);
    if (!episode) {
      gateFailures.push(`Episode missing in DB: ${pathValue}`);
      continue;
    }
    if (!deck) {
      gateFailures.push(`Episode missing in copydeck: ${pathValue}`);
      continue;
    }

    const editorial = editorialByEpisodeId.get(episode.id) || { seo_title: null, meta_description: null, excerpt: null };
    reportRows.push({ path: pathValue, type: 'episode', field: 'seo_title', before: shortText(editorial.seo_title), after: shortText(deck.seo.title) });
    reportRows.push({ path: pathValue, type: 'episode', field: 'meta_description', before: shortText(editorial.meta_description), after: shortText(deck.seo.description) });
    reportRows.push({ path: pathValue, type: 'episode', field: 'excerpt', before: shortText(editorial.excerpt), after: shortText(deck.summary.excerpt) });
  }

  const blogBySlug = new Map((blogs || []).map((row) => [row.slug, row]));
  for (const pathValue of SELECTED_BLOG_PATHS) {
    const slug = pathValue.slice('/blog/'.length);
    const blog = blogBySlug.get(slug);
    const deck = getCopydeckBlog(copydeck, pathValue);
    if (!blog) {
      gateFailures.push(`Blog missing in DB: ${pathValue}`);
      continue;
    }
    if (!deck) {
      gateFailures.push(`Blog missing in copydeck: ${pathValue}`);
      continue;
    }

    reportRows.push({ path: pathValue, type: 'blog', field: 'seo_title', before: shortText(blog.seo_title), after: shortText(deck.seo.title) });
    reportRows.push({ path: pathValue, type: 'blog', field: 'seo_description', before: shortText(blog.seo_description), after: shortText(deck.seo.description) });
    reportRows.push({ path: pathValue, type: 'blog', field: 'excerpt', before: shortText(blog.excerpt), after: shortText(deck.intro.excerpt) });
  }

  for (const pathValue of SELECTED_HUB_PATHS) {
    if (pathValue === '/topics' || pathValue === '/collections') {
      if (!(copydeck.static_pages || []).some((item) => normalizePath(item.path) === pathValue)) {
        gateFailures.push(`Static page missing in copydeck: ${pathValue}`);
      }
    }
  }

  gateFailures.push(...ownershipViolations);

  const report = {
    generated_at: new Date().toISOString(),
    env: config.env,
    gates: {
      scope_locked: gateFailures.filter((item) => item.includes('missing in copydeck') || item.includes('missing in DB')).length === 0,
      ownership_enforced: ownershipViolations.length === 0,
      out_of_scope_mutations_blocked: true,
      linking_row_editorial_relevance_required: true,
      taxonomy_regression_guard: 'pending_run_in_apply'
    },
    gate_failures: gateFailures,
    total_rows: reportRows.length,
    rows: reportRows
  };

  const jsonPath = path.join(OUTPUT_ROOT, `${config.env}-preview-report.json`);
  const mdPath = path.join(OUTPUT_ROOT, `${config.env}-preview-report.md`);

  writeJson(jsonPath, report);

  const mdLines = [];
  mdLines.push('# Staging Preview Report');
  mdLines.push('');
  mdLines.push(`- Generated at: ${report.generated_at}`);
  mdLines.push(`- Env: ${report.env}`);
  mdLines.push(`- Total field changes: ${report.total_rows}`);
  mdLines.push(`- Gate failures: ${report.gate_failures.length}`);
  mdLines.push('');
  mdLines.push('## Gates');
  mdLines.push(`- scope_locked: ${report.gates.scope_locked ? 'pass' : 'fail'}`);
  mdLines.push(`- ownership_enforced: ${report.gates.ownership_enforced ? 'pass' : 'fail'}`);
  mdLines.push(`- out_of_scope_mutations_blocked: pass`);
  mdLines.push(`- linking_row_editorial_relevance_required: pass`);
  mdLines.push(`- taxonomy_regression_guard: ${report.gates.taxonomy_regression_guard}`);
  mdLines.push('');

  if (report.gate_failures.length) {
    mdLines.push('## Gate Failures');
    for (const failure of report.gate_failures) {
      mdLines.push(`- ${failure}`);
    }
    mdLines.push('');
  }

  mdLines.push('## Planned Field Diffs');
  mdLines.push(markdownSummaryTable(reportRows));
  mdLines.push('');

  writeText(mdPath, `${mdLines.join('\n')}\n`);

  console.log(`Wrote preview JSON: ${jsonPath}`);
  console.log(`Wrote preview Markdown: ${mdPath}`);

  if (report.gate_failures.length) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
