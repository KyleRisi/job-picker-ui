import { getPodcastEpisodes } from '@/lib/podcast';
import { listAuthorArchive, listPublishedBlogPosts, listTaxonomy } from '@/lib/blog/data';
import { getPublicSiteUrl } from '@/lib/site-url';

type ChangeFrequency = 'daily' | 'weekly';

type SitemapEntry = {
  url: string;
  lastModified: Date;
  changeFrequency: ChangeFrequency;
  priority: number;
};

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
      (entry) =>
        `<url><loc>${escapeXml(entry.url)}</loc><lastmod>${entry.lastModified.toISOString()}</lastmod><changefreq>${entry.changeFrequency}</changefreq><priority>${entry.priority}</priority></url>`
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${rows}</urlset>`;
}

async function getEntries(): Promise<SitemapEntry[]> {
  const siteUrl = getPublicSiteUrl();
  const now = new Date();

  const staticRoutes: SitemapEntry[] = [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1
    },
    {
      url: `${siteUrl}/jobs`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9
    },
    {
      url: `${siteUrl}/episodes`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.85
    },
    {
      url: `${siteUrl}/blog`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9
    },
    {
      url: `${siteUrl}/reviews`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7
    },
    {
      url: `${siteUrl}/connect`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7
    },
    {
      url: `${siteUrl}/meet-the-team`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7
    },
    {
      url: `${siteUrl}/connect/press-kit`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7
    },
    {
      url: `${siteUrl}/merch`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.75
    },
    {
      url: `${siteUrl}/merch/crotch-dangler`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7
    }
  ];

  try {
    const [episodes, blogPosts, categories, seriesItems, topics, authors] = await Promise.all([
      getPodcastEpisodes({ descriptionMaxLength: 120 }),
      listPublishedBlogPosts({ page: 1, limit: 200 }),
      listTaxonomy('categories'),
      listTaxonomy('series'),
      listTaxonomy('topic_clusters'),
      listTaxonomy('blog_authors')
    ]);

    const episodeRoutes: SitemapEntry[] = episodes.map((episode) => ({
      url: `${siteUrl}/episodes/${episode.slug}`,
      lastModified: new Date(episode.publishedAt),
      changeFrequency: 'weekly',
      priority: 0.75
    }));

    const blogRoutes: SitemapEntry[] = blogPosts.items.map((post) => ({
      url: `${siteUrl}/blog/${post.slug}`,
      lastModified: new Date(post.updated_at || post.published_at || now.toISOString()),
      changeFrequency: 'weekly',
      priority: 0.8
    }));

    const archiveRoutes: SitemapEntry[] = [
      ...categories.map((item: any) => ({
        url: `${siteUrl}/blog/category/${item.slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as ChangeFrequency,
        priority: 0.6
      })),
      ...seriesItems.map((item: any) => ({
        url: `${siteUrl}/blog/series/${item.slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as ChangeFrequency,
        priority: 0.55
      })),
      ...topics.map((item: any) => ({
        url: `${siteUrl}/blog/topic/${item.slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as ChangeFrequency,
        priority: 0.55
      })),
      ...authors.map((item: any) => ({
        url: `${siteUrl}/blog/author/${item.slug}`,
        lastModified: now,
        changeFrequency: 'weekly' as ChangeFrequency,
        priority: 0.4
      }))
    ];

    return [...staticRoutes, ...episodeRoutes, ...blogRoutes, ...archiveRoutes];
  } catch {
    return staticRoutes;
  }
}

export async function GET() {
  const entries = await getEntries();
  return new Response(buildSitemapXml(entries), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300'
    }
  });
}
