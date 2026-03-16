import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DiscoveryHubPage } from '@/components/discovery-hub-page';
import { breadcrumbsToJsonLd } from '@/lib/breadcrumbs';
import { buildHubBreadcrumbs, getDiscoveryHubPage } from '@/lib/episodes';
import { compactJsonLd, getPageEntityIds, resolveCanonicalForSchema } from '@/lib/schema-jsonld';
import { getPublicSiteUrl } from '@/lib/site-url';

export const revalidate = 300;

type Params = {
  slug: string;
};

type SearchParams = {
  page?: string | string[];
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const hub = await getDiscoveryHubPage('collections', params.slug);

  if (!hub) {
    return {
      title: 'Collection Not Found | The Compendium Podcast',
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const siteUrl = getPublicSiteUrl();
  const canonical = resolveCanonicalForSchema({
    candidateCanonical: hub.term.path || null,
    fallbackPath: `/collections/${params.slug}`,
    siteUrl
  });

  return {
    title: `${hub.term.seoTitle || hub.term.name} | Collections | The Compendium Podcast`,
    description: hub.term.metaDescription || hub.term.description || `Explore episodes in ${hub.term.name}.`,
    alternates: {
      canonical: canonical.metadataCanonical
    }
  };
}

export default async function CollectionHubPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const rawPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const parsedPage = Number.parseInt(`${rawPage || '1'}`, 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const hub = await getDiscoveryHubPage('collections', params.slug, page);
  if (!hub) notFound();

  const siteUrl = getPublicSiteUrl();
  const canonical = resolveCanonicalForSchema({
    candidateCanonical: hub.term.path || null,
    fallbackPath: `/collections/${params.slug}`,
    siteUrl
  });
  const pageEntityIds = getPageEntityIds(canonical.absoluteCanonicalUrl);
  const breadcrumbJsonLd = compactJsonLd({
    ...breadcrumbsToJsonLd(buildHubBreadcrumbs('collections', hub.term), siteUrl),
    '@id': pageEntityIds.breadcrumb
  });

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <DiscoveryHubPage routeKey="collections" hub={hub} />
    </>
  );
}
