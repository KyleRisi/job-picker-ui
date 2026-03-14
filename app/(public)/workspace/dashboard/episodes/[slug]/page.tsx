import { notFound } from 'next/navigation';
import { getResolvedEpisodeBySlug, listActiveDiscoveryTerms } from '@/lib/episodes';
import { listBlogAuthors, listBlogPostsAdmin, listPodcastEpisodes } from '@/lib/blog/data';
import { markdownToBlogDocument } from '@/lib/blog/content';
import { WorkspaceBlogEditor } from '@/components/workspace/workspace-blog-editor';

function decodeCommonHtmlEntities(value: string) {
  const decoded = value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ');

  // Handle double-encoded entities like "&amp;nbsp;".
  return /&(?:[a-zA-Z]+|#\d+);/.test(decoded)
    ? decoded
        .replace(/&amp;/g, '&')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#160;/g, ' ')
    : decoded;
}

function normalizeOrphanBulletLines(value: string) {
  const lines = value.split('\n');
  const output: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] || '';
    if (!/^\s*-\s*$/.test(line)) {
      output.push(line);
      continue;
    }

    let next = index + 1;
    while (next < lines.length && /^\s*$/.test(lines[next] || '')) {
      next += 1;
    }

    if (next < lines.length) {
      output.push(`- ${(lines[next] || '').trimStart()}`);
      index = next;
    } else {
      output.push('-');
    }
  }

  return output.join('\n');
}

function htmlToEditorSeedMarkdown(value: string) {
  const source = `${value || ''}`.trim();
  if (!source) return '';

  const withLinks = source.replace(
    /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
    (_match, href: string, text: string) => {
      const cleanText = `${text || ''}`.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const cleanHref = `${href || ''}`.trim();
      if (!cleanText || !cleanHref) return cleanText || '';
      return `[${cleanText}](${cleanHref})`;
    }
  );

  const normalized = decodeCommonHtmlEntities(
    withLinks
      .replace(/<h1\b[^>]*>/gi, '\n\n# ')
      .replace(/<h2\b[^>]*>/gi, '\n\n## ')
      .replace(/<h3\b[^>]*>/gi, '\n\n### ')
      .replace(/<h4\b[^>]*>/gi, '\n\n#### ')
      .replace(/<h5\b[^>]*>/gi, '\n\n##### ')
      .replace(/<h6\b[^>]*>/gi, '\n\n###### ')
      .replace(/<strong\b[^>]*>/gi, '**')
      .replace(/<\/strong>/gi, '**')
      .replace(/<b\b[^>]*>/gi, '**')
      .replace(/<\/b>/gi, '**')
      .replace(/<em\b[^>]*>/gi, '*')
      .replace(/<\/em>/gi, '*')
      .replace(/<i\b[^>]*>/gi, '*')
      .replace(/<\/i>/gi, '*')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|section|article|blockquote|h1|h2|h3|h4|h5|h6)>/gi, '\n\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<\/(ul|ol)>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  return normalizeOrphanBulletLines(normalized);
}

export default async function EpisodeEditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [episode, episodeRows, postRows, discoveryTerms, authorRows] = await Promise.all([
    getResolvedEpisodeBySlug(slug, { includeHidden: true }),
    listPodcastEpisodes({ includeHidden: true }),
    listBlogPostsAdmin({ pageSize: 100, includeDeleted: false, sort: 'updated' }),
    listActiveDiscoveryTerms(),
    listBlogAuthors({ includeArchived: false })
  ]);
  if (!episode) notFound();

  const episodes = episodeRows.map((item) => ({
    id: item.id,
    title: item.title,
    slug: item.slug,
    audioUrl: item.audio_url,
    artworkUrl: item.artwork_url,
    episodeNumber: item.episode_number,
    publishedAt: item.published_at
  }));

  const relatedPosts = (postRows.items || [])
    .map((item) => ({ id: item.id, title: item.title }));

  const discoveryFromEpisode = {
    primaryTopicId: episode.primaryTopic?.id || null,
    topicIds: episode.discoveryTerms.filter((term) => term.termType === 'topic').map((term) => term.id),
    themeIds: episode.discoveryTerms.filter((term) => term.termType === 'theme').map((term) => term.id),
    entityIds: episode.discoveryTerms.filter((term) => term.termType === 'entity').map((term) => term.id),
    caseIds: episode.discoveryTerms.filter((term) => term.termType === 'case').map((term) => term.id),
    eventIds: episode.discoveryTerms.filter((term) => term.termType === 'event').map((term) => term.id),
    collectionIds: episode.discoveryTerms.filter((term) => term.termType === 'collection').map((term) => term.id),
    seriesIds: episode.discoveryTerms.filter((term) => term.termType === 'series').map((term) => term.id)
  };

  const editorial = episode.editorial;
  const sourceSeed = [
    htmlToEditorSeedMarkdown(episode.source.descriptionHtml || ''),
    htmlToEditorSeedMarkdown(episode.source.showNotes || ''),
    (episode.source.descriptionPlain || '').trim()
  ].find((value) => typeof value === 'string' && value.trim());
  const sourceBodyFallback = sourceSeed ? markdownToBlogDocument(sourceSeed) : [];
  const postLike = {
    id: episode.id,
    title: editorial?.webTitle || episode.title || '',
    slug: editorial?.webSlug || episode.slug || '',
    status: episode.isArchived ? 'archived' : (episode.isVisible ? 'published' : 'draft'),
    excerpt: editorial?.excerpt || '',
    content_json: Array.isArray(episode.bodyJson) && episode.bodyJson.length ? episode.bodyJson : sourceBodyFallback,
    published_at: episode.publishedAt || null,
    is_featured: episode.isFeatured,
    author_id: editorial?.authorId || null,
    author: null,
    featured_image: {
      id: null,
      url: editorial?.heroImageUrl || episode.heroImageUrl || episode.artworkUrl || '',
      alt_text: null
    },
    taxonomies: {
      categories: [],
      tags: []
    },
    revisions: [],
    seo_title: editorial?.seoTitle || episode.seoTitle || null,
    seo_description: editorial?.metaDescription || null,
    focus_keyword: null,
    canonical_url: editorial?.canonicalUrlOverride || episode.canonicalUrl || null,
    noindex: episode.noindex,
    nofollow: episode.nofollow,
    social_title: editorial?.socialTitle || null,
    social_description: editorial?.socialDescription || null,
    og_image_id: editorial?.socialImageUrl || null,
    featured_image_storage_path: editorial?.heroImageStoragePath || null,
    discovery: discoveryFromEpisode,
    linked_episodes: episode.relatedEpisodes.map((item) => ({
      episode: { id: item.episode.id },
      episode_id: item.episode.id
    })),
    related_override_ids: episode.relatedPosts.map((item) => item.id),
    episode: {
      id: episode.id,
      slug: episode.slug,
      title: episode.title
    },
    source: {
      is_visible: episode.isVisible,
      is_archived: episode.isArchived,
      last_synced_at: episode.source.lastSyncedAt || null
    },
    editorial: {
      hero_image_storage_path: editorial?.heroImageStoragePath || null,
      author_id: editorial?.authorId || null
    }
  };

  const taxonomyOptions = {
    categories: discoveryTerms.filter((term) => term.termType === 'topic').map((term) => ({ id: term.id, name: term.name })),
    topics: discoveryTerms.filter((term) => term.termType === 'topic').map((term) => ({ id: term.id, name: term.name })),
    themes: discoveryTerms.filter((term) => term.termType === 'theme').map((term) => ({ id: term.id, name: term.name })),
    collections: discoveryTerms.filter((term) => term.termType === 'collection').map((term) => ({ id: term.id, name: term.name })),
    series: discoveryTerms.filter((term) => term.termType === 'series').map((term) => ({ id: term.id, name: term.name }))
  };

  return (
    <WorkspaceBlogEditor
      mode="episode"
      episodeId={episode.id}
      post={postLike as any}
      episodes={episodes}
      relatedPosts={relatedPosts}
      authors={authorRows.map((author) => ({ id: author.id, name: author.name }))}
      taxonomyOptions={taxonomyOptions}
    />
  );
}
