import { getResolvedEpisodes, listActiveDiscoveryTerms } from '@/lib/episodes';
import { listBlogAuthors, listPublishedBlogPostsForSitemap } from '@/lib/blog/data';
import { getJobsForPublic } from '@/lib/data';
import { getPublicSiteUrl } from '@/lib/site-url';
import { getApprovedCollectionSlugs, getApprovedTopicSlugs } from '@/lib/taxonomy-route-policy';

export const revalidate = 300;

type ChangeFrequency = 'daily' | 'weekly';

type SitemapEntry = {
  url: string;
  lastModified?: string;
  changeFrequency: ChangeFrequency;
  priority: number;
};

const EXCLUDED_SITEMAP_PATHS = new Set<string>([
  '/freaky-register',
  '/preview/homepage-v2'
]);

function toIsoIfValid(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function pickFirstIso(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    const iso = toIsoIfValid(value);
    if (iso) return iso;
  }
  return undefined;
}

function pickLatestIso(values: Array<string | null | undefined>): string | undefined {
  let latest: string | null = null;
  for (const value of values) {
    const iso = toIsoIfValid(value);
    if (!iso) continue;
    if (!latest || iso > latest) latest = iso;
  }
  return latest || undefined;
}

function runSitemapDateSelectionAssertions() {
  const updated = '2026-01-15T12:00:00.000Z';
  const published = '2025-12-10T08:30:00.000Z';

  const preferredUpdated = pickFirstIso(updated, published);
  if (preferredUpdated !== updated) {
    throw new Error('Sitemap lastmod regression: updated timestamp must be preferred over published timestamp.');
  }

  const fallbackPublished = pickFirstIso('not-a-date', published);
  if (fallbackPublished !== published) {
    throw new Error('Sitemap lastmod regression: published timestamp should be used when updated timestamp is invalid.');
  }

  const omittedWithoutReliableDate = pickFirstIso(undefined, null, '');
  if (omittedWithoutReliableDate !== undefined) {
    throw new Error('Sitemap lastmod regression: lastmod must be omitted when no reliable timestamp exists.');
  }

  const latestArchiveDate = pickLatestIso([published, updated]);
  if (latestArchiveDate !== updated) {
    throw new Error('Sitemap lastmod regression: archive lastmod should use the latest meaningful child timestamp.');
  }
}

if (process.env.NODE_ENV !== 'production') {
  runSitemapDateSelectionAssertions();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSitemapXml(entries: SitemapEntry[]): string {
  const rows = entries
    .map(
      (entry) => {
        const lastmod = entry.lastModified ? `<lastmod>${entry.lastModified}</lastmod>` : '';
        return `<url><loc>${escapeXml(entry.url)}</loc>${lastmod}<changefreq>${entry.changeFrequency}</changefreq><priority>${entry.priority}</priority></url>`;
      }
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows}</urlset>`;
}

function excludeRoutesFromSitemap(entries: SitemapEntry[]): SitemapEntry[] {
  return entries.filter((entry) => {
    const path = new URL(entry.url).pathname;
    return !EXCLUDED_SITEMAP_PATHS.has(path);
  });
}

async function getEntries(): Promise<SitemapEntry[]> {
  const siteUrl = getPublicSiteUrl();
  const approvedTopicSlugs = new Set(getApprovedTopicSlugs());
  const approvedCollectionSlugs = new Set(getApprovedCollectionSlugs());

  const stableStaticRoutes: SitemapEntry[] = [
    {
      url: `${siteUrl}/`,
      changeFrequency: 'weekly',
      priority: 1
    },
    {
      url: `${siteUrl}/jobs`,
      changeFrequency: 'daily',
      priority: 0.9
    },
    {
      url: `${siteUrl}/episodes`,
      changeFrequency: 'daily',
      priority: 0.85
    },
    {
      url: `${siteUrl}/topics`,
      changeFrequency: 'weekly',
      priority: 0.8
    },
    {
      url: `${siteUrl}/collections`,
      changeFrequency: 'weekly',
      priority: 0.7
    },
    {
      url: `${siteUrl}/blog`,
      changeFrequency: 'daily',
      priority: 0.9
    },
    {
      url: `${siteUrl}/reviews`,
      changeFrequency: 'weekly',
      priority: 0.7
    },
    {
      url: `${siteUrl}/about`,
      changeFrequency: 'weekly',
      priority: 0.7
    },
    {
      url: `${siteUrl}/connect`,
      changeFrequency: 'weekly',
      priority: 0.7
    },
    {
      url: `${siteUrl}/meet-the-team`,
      changeFrequency: 'weekly',
      priority: 0.7
    },
    {
      url: `${siteUrl}/patreon`,
      changeFrequency: 'weekly',
      priority: 0.85
    },
    {
      url: `${siteUrl}/connect/press-kit`,
      changeFrequency: 'weekly',
      priority: 0.7
    },
    {
      url: `${siteUrl}/merch`,
      changeFrequency: 'weekly',
      priority: 0.75
    },
    {
      url: `${siteUrl}/merch/crotch-dangler`,
      changeFrequency: 'weekly',
      priority: 0.7
    }
  ];

  try {
    const [episodes, blogPosts, authors, discoveryTerms, jobs] = await Promise.all([
      getResolvedEpisodes({ descriptionMaxLength: 120 }),
      listPublishedBlogPostsForSitemap(),
      listBlogAuthors(),
      listActiveDiscoveryTerms(),
      getJobsForPublic()
    ]);

    const episodeRoutes: SitemapEntry[] = episodes
      .filter((episode) => !episode.noindex && episode.isVisible && !episode.isArchived)
      .map((episode) => ({
      url: `${siteUrl}${episode.canonicalUrl}`,
      lastModified: pickFirstIso(episode.editorial?.updatedAt, episode.publishedAt),
      changeFrequency: 'weekly',
      priority: 0.75
    }));

    const blogRoutes: SitemapEntry[] = blogPosts.map((post) => ({
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: pickFirstIso(post.updated_at, post.published_at),
      changeFrequency: 'weekly',
      priority: 0.8
    }));

    const latestBlogByAuthorId = new Map<string, string>();
    for (const post of blogPosts) {
      const authorId = `${post.author_id || ''}`.trim();
      if (!authorId) continue;
      const next = pickFirstIso(post.updated_at, post.published_at);
      if (!next) continue;
      const previous = latestBlogByAuthorId.get(authorId);
      if (!previous || next > previous) {
        latestBlogByAuthorId.set(authorId, next);
      }
    }

    const episodesArchiveLastmod = pickLatestIso(episodeRoutes.map((entry) => entry.lastModified));
    const blogArchiveLastmod = pickLatestIso(blogRoutes.map((entry) => entry.lastModified));
    const jobsArchiveLastmod = pickLatestIso(
      jobs.flatMap((job) => [job.updated_at, job.created_at, job.filledAt] as Array<string | null | undefined>)
    );
    const homepageLastmod = pickLatestIso([episodesArchiveLastmod, blogArchiveLastmod, jobsArchiveLastmod]);

    const staticRoutes: SitemapEntry[] = stableStaticRoutes.map((entry) => {
      if (entry.url === `${siteUrl}/`) {
        return { ...entry, lastModified: homepageLastmod };
      }
      if (entry.url === `${siteUrl}/jobs`) {
        return { ...entry, lastModified: jobsArchiveLastmod };
      }
      if (entry.url === `${siteUrl}/episodes`) {
        return { ...entry, lastModified: episodesArchiveLastmod };
      }
      if (entry.url === `${siteUrl}/blog`) {
        return { ...entry, lastModified: blogArchiveLastmod };
      }
      return entry;
    });

    const archiveRoutes: SitemapEntry[] = [
      ...authors.map((item: any) => ({
        url: `${siteUrl}/blog/author/${item.slug}`,
        lastModified: latestBlogByAuthorId.get(item.id),
        changeFrequency: 'weekly' as ChangeFrequency,
        priority: 0.4
      })),
      ...discoveryTerms
        .filter((item) => {
          if (!item.path) return false;
          if (item.termType === 'topic') return approvedTopicSlugs.has(item.slug);
          if (item.termType === 'collection') return approvedCollectionSlugs.has(item.slug);
          return false;
        })
        .map((item) => ({
          url: `${siteUrl}${item.path}`,
          lastModified: pickFirstIso(item.updatedAt),
          changeFrequency: 'weekly' as ChangeFrequency,
          priority: 0.65
      }))
    ];

    return excludeRoutesFromSitemap([...staticRoutes, ...episodeRoutes, ...blogRoutes, ...archiveRoutes]);
  } catch {
    return excludeRoutesFromSitemap(stableStaticRoutes);
  }
}

export async function GET() {
  const entries = await getEntries();
  return new Response(buildSitemapXml(entries), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate'
    }
  });
}
