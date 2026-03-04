import { STATUS } from '@/lib/constants';
import { getJobsForPublic } from '@/lib/data';
import { getPodcastEpisodes } from '@/lib/podcast';
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
    const [jobs, episodes] = await Promise.all([
      getJobsForPublic(),
      getPodcastEpisodes({ descriptionMaxLength: 120 })
    ]);

    const jobRoutes: SitemapEntry[] = jobs
      .filter((job) => job.status === STATUS.AVAILABLE || job.status === STATUS.REHIRING)
      .map((job) => ({
        url: `${siteUrl}/jobs/${job.id}`,
        lastModified: now,
        changeFrequency: 'daily',
        priority: 0.8
      }));

    const episodeRoutes: SitemapEntry[] = episodes.map((episode) => ({
      url: `${siteUrl}/episodes/${episode.slug}`,
      lastModified: new Date(episode.publishedAt),
      changeFrequency: 'weekly',
      priority: 0.75
    }));

    return [...staticRoutes, ...jobRoutes, ...episodeRoutes];
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
