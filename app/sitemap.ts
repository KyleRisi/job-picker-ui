import type { MetadataRoute } from 'next';
import { STATUS } from '@/lib/constants';
import { getJobsForPublic } from '@/lib/data';
import { getPodcastEpisodes } from '@/lib/podcast';
import { getPublicSiteUrl } from '@/lib/site-url';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getPublicSiteUrl();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
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
    const jobRoutes: MetadataRoute.Sitemap = jobs
      .filter((job) => job.status === STATUS.AVAILABLE || job.status === STATUS.REHIRING)
      .map((job) => ({
        url: `${siteUrl}/jobs/${job.id}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.8
      }));

    const episodeRoutes: MetadataRoute.Sitemap = episodes.map((episode) => ({
      url: `${siteUrl}/episodes/${episode.slug}`,
      lastModified: new Date(episode.publishedAt),
      changeFrequency: 'weekly' as const,
      priority: 0.75
    }));

    return [...staticRoutes, ...jobRoutes, ...episodeRoutes];
  } catch {
    return staticRoutes;
  }
}
