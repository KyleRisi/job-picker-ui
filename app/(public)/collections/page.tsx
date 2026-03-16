import type { Metadata } from 'next';
import { DiscoveryTermIndexPage } from '@/components/discovery-term-index-page';
import { breadcrumbsToJsonLd } from '@/lib/breadcrumbs';
import { listActiveDiscoveryTerms } from '@/lib/episodes';
import { getHubIndexSeo } from '@/lib/seo-page-copy';
import { compactJsonLd, getPageEntityIds, resolveCanonicalForSchema } from '@/lib/schema-jsonld';
import { getPublicSiteUrl } from '@/lib/site-url';

export const revalidate = 300;

const seo = getHubIndexSeo('collections');

export const metadata: Metadata = {
  title: seo.title,
  description: seo.description,
  alternates: {
    canonical: '/collections'
  }
};

export default async function CollectionsIndexPage() {
  const siteUrl = getPublicSiteUrl();
  const canonical = resolveCanonicalForSchema({
    candidateCanonical: '/collections',
    fallbackPath: '/collections',
    siteUrl
  });
  const pageEntityIds = getPageEntityIds(canonical.absoluteCanonicalUrl);
  const breadcrumbJsonLd = compactJsonLd({
    ...breadcrumbsToJsonLd(
      [
        { name: 'Home', href: '/' },
        { name: 'Collections', href: '/collections' }
      ],
      siteUrl
    ),
    '@id': pageEntityIds.breadcrumb
  });
  const terms = (await listActiveDiscoveryTerms()).filter((term) => term.termType === 'collection' && term.path);
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <DiscoveryTermIndexPage routeKey="collections" terms={terms} />
    </>
  );
}
