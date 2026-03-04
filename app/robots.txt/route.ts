import { getPublicSiteUrl } from '@/lib/site-url';

export async function GET() {
  const siteUrl = getPublicSiteUrl();
  const body = [
    'User-Agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /my-job',
    'Disallow: /apply',
    'Disallow: /api',
    '',
    `Sitemap: ${siteUrl}/sitemap.xml`
  ].join('\n');

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300'
    }
  });
}
