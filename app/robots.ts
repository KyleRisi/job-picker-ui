import type { MetadataRoute } from 'next';
import { getPublicSiteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getPublicSiteUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/my-job', '/apply', '/api']
      }
    ],
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
