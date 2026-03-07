import { listPublishedBlogPosts } from '@/lib/blog/data';
import { getPublicSiteUrl } from '@/lib/site-url';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const siteUrl = getPublicSiteUrl();
  let items = '';
  try {
    const data = await listPublishedBlogPosts({ page: 1, limit: 50 });
    items = data.items
      .map((post) => {
        const description = post.excerpt || post.excerpt_auto || '';
        return `<item><title>${escapeXml(post.title)}</title><link>${siteUrl}/blog/${post.slug}</link><guid>${siteUrl}/blog/${post.slug}</guid><pubDate>${new Date(post.published_at || post.created_at).toUTCString()}</pubDate><description>${escapeXml(description)}</description></item>`;
      })
      .join('');
  } catch {
    items = '';
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>The Compendium Blog</title><link>${siteUrl}/blog</link><description>Search-friendly articles from The Compendium podcast.</description>${items}</channel></rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300'
    }
  });
}
