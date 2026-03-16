import type { Metadata } from 'next';
import { DiscoveryTermIndexPage } from '@/components/discovery-term-index-page';
import { breadcrumbsToJsonLd } from '@/lib/breadcrumbs';
import { listActiveDiscoveryTerms } from '@/lib/episodes';
import { getHubIndexSeo } from '@/lib/seo-page-copy';
import { compactJsonLd, getPageEntityIds, resolveCanonicalForSchema } from '@/lib/schema-jsonld';
import { getPublicSiteUrl } from '@/lib/site-url';

export const revalidate = 300;

const seo = getHubIndexSeo('topics');

export const metadata: Metadata = {
  title: seo.title,
  description: seo.description,
  alternates: {
    canonical: '/topics'
  }
};

export default async function TopicsIndexPage() {
  const siteUrl = getPublicSiteUrl();
  const canonical = resolveCanonicalForSchema({
    candidateCanonical: '/topics',
    fallbackPath: '/topics',
    siteUrl
  });
  const pageEntityIds = getPageEntityIds(canonical.absoluteCanonicalUrl);
  const breadcrumbJsonLd = compactJsonLd({
    ...breadcrumbsToJsonLd(
      [
        { name: 'Home', href: '/' },
        { name: 'Topics', href: '/topics' }
      ],
      siteUrl
    ),
    '@id': pageEntityIds.breadcrumb
  });
  const terms = (await listActiveDiscoveryTerms()).filter((term) => term.termType === 'topic' && term.path);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <DiscoveryTermIndexPage routeKey="topics" terms={terms} />
    </>
  );
}
