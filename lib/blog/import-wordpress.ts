import { randomUUID } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { normalizePath } from '@/lib/redirects';
import { createRichText, slugifyBlogText } from './content';
import {
  createImportJob,
  getImportJob,
  listBlogAuthors,
  listTaxonomy,
  replaceImportJobRecords,
  saveBlogPost,
  updateImportJob,
  upsertTaxonomy
} from './data';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  trimValues: true
});

type WordpressPreviewRecord = {
  sourceKey: string;
  sourceUrl: string;
  title: string;
  slug: string;
  status: 'preview' | 'duplicate' | 'collision' | 'ready';
  message: string;
  previewPayload: Record<string, unknown>;
};

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function nodeText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return `${value}`.trim();
  if (typeof value === 'object' && '#text' in (value as Record<string, unknown>)) {
    return `${(value as Record<string, unknown>)['#text'] || ''}`.trim();
  }
  return '';
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlToBlocks(html: string) {
  const normalized = decodeHtml(html || '').replace(/\r/g, '').trim();
  if (!normalized) {
    return [{ id: randomUUID(), type: 'paragraph', content: createRichText('') }];
  }

  const blocks: Array<Record<string, unknown>> = [];
  const imageRe = /<img\b[^>]*src=["']([^"']+)["'][^>]*alt=["']?([^"'>]*)["']?[^>]*>/gi;
  const chunk = normalized
    .replace(/<h([2-6])[^>]*>(.*?)<\/h\1>/gis, (_match, level, text) => {
      blocks.push({
        id: randomUUID(),
        type: 'heading',
        level: Number(level),
        content: createRichText(text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
      });
      return '\n';
    })
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (_match, text) => {
      blocks.push({
        id: randomUUID(),
        type: 'blockquote',
        quote: createRichText(text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()),
        attribution: ''
      });
      return '\n';
    })
    .replace(/<(ul|ol)[^>]*>(.*?)<\/\1>/gis, (_match, tagName, inner) => {
      const items = [...inner.matchAll(/<li[^>]*>(.*?)<\/li>/gis)].map((match) => ({
        id: randomUUID(),
        content: createRichText(match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
      }));
      blocks.push({
        id: randomUUID(),
        type: 'list',
        style: tagName === 'ol' ? 'ordered' : 'bullet',
        items
      });
      return '\n';
    })
    .replace(imageRe, (_match, src, alt) => {
      blocks.push({
        id: randomUUID(),
        type: 'image',
        assetId: null,
        src,
        alt: alt || '',
        caption: '',
        credit: '',
        size: 'wide'
      });
      return '\n';
    });

  chunk
    .split(/<\/p>|<br\s*\/?>|\n{2,}/i)
    .map((part) => part.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .forEach((text) => {
      blocks.push({
        id: randomUUID(),
        type: 'paragraph',
        content: createRichText(text)
      });
    });

  return blocks.length ? blocks : [{ id: randomUUID(), type: 'paragraph', content: createRichText('') }];
}

function parseWxr(xml: string) {
  const parsed = parser.parse(xml) as {
    rss?: {
      channel?: {
        item?: Array<Record<string, unknown>> | Record<string, unknown>;
      };
    };
  };
  return toArray(parsed.rss?.channel?.item);
}

async function getExistingPostMap(slugs: string[]) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from('blog_posts').select('id, slug, title').in('slug', slugs);
  if (error) throw error;
  return new Map((data || []).map((item) => [item.slug, item]));
}

export async function previewWordpressImport(xml: string) {
  const items = parseWxr(xml);
  const postItems = items.filter((item) => nodeText(item['wp:post_type']) === 'post');
  const slugs = postItems.map((item) => slugifyBlogText(nodeText(item['wp:post_name']) || nodeText(item.title)));
  const existingMap = await getExistingPostMap(slugs);

  const records: WordpressPreviewRecord[] = postItems.map((item) => {
    const title = nodeText(item.title) || 'Untitled import';
    const slug = slugifyBlogText(nodeText(item['wp:post_name']) || title);
    const sourceKey = nodeText(item['wp:post_id']) || slug;
    const sourceUrl = nodeText(item.link);
    const existing = existingMap.get(slug);
    const categories = toArray(item.category)
      .map((entry) => {
        if (typeof entry === 'string') return { domain: 'category', nicename: slugifyBlogText(entry), label: entry };
        return {
          domain: `${(entry as Record<string, unknown>).domain || ''}`,
          nicename: `${(entry as Record<string, unknown>).nicename || slugifyBlogText(nodeText(entry))}`,
          label: nodeText(entry)
        };
      });

    const previewPayload = {
      title,
      slug,
      excerpt: decodeHtml(nodeText(item['excerpt:encoded'])),
      contentJson: htmlToBlocks(nodeText(item['content:encoded'])),
      publishedAt: nodeText(item['wp:post_date_gmt']) || nodeText(item.pubDate) || null,
      status: nodeText(item['wp:status']) === 'publish' ? 'published' : 'draft',
      categories: categories.filter((entry) => entry.domain === 'category'),
      tags: categories.filter((entry) => entry.domain === 'post_tag'),
      legacyUrl: sourceUrl
    };

    if (existing) {
      return {
        sourceKey,
        sourceUrl,
        title,
        slug,
        status: 'duplicate',
        message: 'Slug already exists and will be skipped unless manually changed.',
        previewPayload
      };
    }

    return {
      sourceKey,
      sourceUrl,
      title,
      slug,
      status: 'ready',
      message: 'Ready to import.',
      previewPayload
    };
  });

  const job = await createImportJob('wordpress_xml', {
    recordCount: records.length
  });
  await replaceImportJobRecords(
    job.id,
    records.map((record) => ({
      source_key: record.sourceKey,
      source_url: record.sourceUrl,
      source_title: record.title,
      status: record.status,
      message: record.message,
      preview_payload: record.previewPayload
    }))
  );
  await updateImportJob(job.id, {
    status: 'previewed',
    completed_at: new Date().toISOString(),
    log_output: `Previewed ${records.length} WordPress posts.`
  });

  return {
    jobId: job.id,
    items: records
  };
}

async function ensureTerm(kind: 'categories' | 'tags', name: string, slug: string) {
  const existing = await listTaxonomy(kind);
  const found = existing.find((item) => item.slug === slug);
  if (found) return found.id;
  const created = await upsertTaxonomy(kind, {
    name,
    slug
  });
  return created.id as string;
}

async function ensureAuthor() {
  const authors = await listBlogAuthors();
  return authors[0]?.id;
}

export async function runWordpressImport(jobId: string) {
  const job = await getImportJob(jobId);
  if (!job) {
    throw new Error('Import job not found.');
  }

  await updateImportJob(jobId, {
    status: 'running',
    started_at: new Date().toISOString()
  });

  let recordsCreated = 0;
  let recordsFailed = 0;
  const supabase = createSupabaseAdminClient();
  const authorId = await ensureAuthor();
  if (!authorId) throw new Error('No blog author available for import.');

  for (const record of job.records || []) {
    try {
      if (record.status === 'duplicate') continue;
      const preview = record.preview_payload as {
        title: string;
        slug: string;
        excerpt: string;
        contentJson: unknown;
        publishedAt: string | null;
        status: string;
        categories: Array<{ label: string; nicename: string }>;
        tags: Array<{ label: string; nicename: string }>;
        legacyUrl: string;
      };

      const categoryIds = [];
      for (const category of preview.categories || []) {
        categoryIds.push(await ensureTerm('categories', category.label, slugifyBlogText(category.nicename || category.label)));
      }
      const tagIds = [];
      for (const tag of preview.tags || []) {
        tagIds.push(await ensureTerm('tags', tag.label, slugifyBlogText(tag.nicename || tag.label)));
      }

      const saved = await saveBlogPost(null, {
        title: preview.title,
        slug: preview.slug,
        status: preview.status === 'published' ? 'published' : 'draft',
        excerpt: preview.excerpt || null,
        contentJson: preview.contentJson,
        featuredImageId: null,
        authorId,
        publishedAt: preview.publishedAt ? new Date(preview.publishedAt).toISOString() : null,
        scheduledAt: null,
        archivedAt: null,
        isFeatured: false,
        primaryCategoryId: categoryIds[0] || null,
        taxonomy: {
          categoryIds,
          tagIds,
          seriesIds: [],
          topicClusterIds: [],
          labelIds: []
        },
        linkedEpisodes: [],
        relatedPostIds: [],
        seo: {
          seoTitle: preview.title,
          seoDescription: preview.excerpt || null,
          socialTitle: preview.title,
          socialDescription: preview.excerpt || null,
          canonicalUrl: null,
          noindex: false,
          nofollow: false,
          focusKeyword: null,
          schemaType: 'BlogPosting',
          ogImageId: null
        },
        revisionReason: 'Imported from WordPress XML'
      });

      if (preview.legacyUrl) {
        const legacyPath = normalizePath(new URL(preview.legacyUrl, 'https://example.com').pathname);
        await supabase.from('redirects').upsert(
          {
            source_path: legacyPath,
            target_url: `/blog/${saved?.slug || preview.slug}`,
            status_code: 301,
            match_type: 'exact',
            is_active: true,
            priority: 220,
            notes: 'Created by WordPress import.',
            source_type: 'blog_import',
            source_ref: jobId
          },
          { onConflict: 'source_path,match_type' }
        );
      }

      await supabase
        .from('import_job_records')
        .update({
          status: 'imported',
          message: 'Imported successfully.',
          target_post_id: saved?.id || null
        })
        .eq('id', record.id);
      recordsCreated += 1;
    } catch (error) {
      recordsFailed += 1;
      await supabase
        .from('import_job_records')
        .update({
          status: 'failed',
          message: error instanceof Error ? error.message : 'Import failed.'
        })
        .eq('id', record.id);
    }
  }

  await updateImportJob(jobId, {
    status: recordsFailed > 0 ? 'partial' : 'succeeded',
    completed_at: new Date().toISOString(),
    records_created: recordsCreated,
    records_failed: recordsFailed,
    log_output: `Imported ${recordsCreated} record(s), ${recordsFailed} failed.`
  });

  return getImportJob(jobId);
}
