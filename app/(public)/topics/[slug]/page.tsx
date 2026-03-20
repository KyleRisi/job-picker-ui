import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DiscoveryHubPage } from '@/components/discovery-hub-page';
import { TrueCrimeTopicHub } from '@/components/true-crime-topic-hub';
import { breadcrumbsToJsonLd } from '@/lib/breadcrumbs';
import { buildHubBreadcrumbs, getDiscoveryHubPage, getResolvedEpisodes } from '@/lib/episodes';
import { compactJsonLd, getPageEntityIds, resolveCanonicalForSchema } from '@/lib/schema-jsonld';
import { getPublicSiteUrl } from '@/lib/site-url';
import { getTopicHubConfig } from '@/lib/topic-hub/topic-hub-config';
import {
  buildTrueCrimeEditorialGroups,
  buildTrueCrimeFeaturedSelection,
  getTrueCrimeTopicEpisodes
} from '@/lib/true-crime-topic';

export const revalidate = 300;

type Params = {
  slug: string;
};

type SearchParams = {
  page?: string | string[];
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const hub = await getDiscoveryHubPage('topics', params.slug);
  const topicHubConfig = getTopicHubConfig(params.slug);

  if (!hub) {
    return {
      title: 'Topic Not Found | The Compendium Podcast',
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const siteUrl = getPublicSiteUrl();
  const canonical = resolveCanonicalForSchema({
    candidateCanonical: hub.term.path || null,
    fallbackPath: `/topics/${params.slug}`,
    siteUrl
  });

  if (topicHubConfig?.seoOverride) {
    return {
      title: {
        absolute: topicHubConfig.seoOverride.titleAbsolute
      },
      description: topicHubConfig.seoOverride.description,
      alternates: {
        canonical: canonical.metadataCanonical
      }
    };
  }

  return {
    title: `${hub.term.seoTitle || hub.term.name} | Topics`,
    description: hub.term.metaDescription || hub.term.description || `Explore episodes in ${hub.term.name}.`,
    alternates: {
      canonical: canonical.metadataCanonical
    }
  };
}

export default async function TopicHubPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const rawPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const parsedPage = Number.parseInt(`${rawPage || '1'}`, 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const hub = await getDiscoveryHubPage('topics', params.slug, page);
  if (!hub) notFound();

  const siteUrl = getPublicSiteUrl();
  const canonical = resolveCanonicalForSchema({
    candidateCanonical: hub.term.path || null,
    fallbackPath: `/topics/${params.slug}`,
    siteUrl
  });
  const pageEntityIds = getPageEntityIds(canonical.absoluteCanonicalUrl);
  const breadcrumbJsonLd = compactJsonLd({
    ...breadcrumbsToJsonLd(buildHubBreadcrumbs('topics', hub.term), siteUrl),
    '@id': pageEntityIds.breadcrumb
  });

  if (params.slug === 'true-crime') {
    const allEpisodes = await getResolvedEpisodes({
      includeHidden: false,
      descriptionMaxLength: 220
    });
    const trueCrimeEpisodes = getTrueCrimeTopicEpisodes(allEpisodes);
    const featuredEpisodes = buildTrueCrimeFeaturedSelection(trueCrimeEpisodes);
    const groupedSections = buildTrueCrimeEditorialGroups({
      episodes: trueCrimeEpisodes,
      featuredEpisodeIds: new Set(featuredEpisodes.map((episode) => episode.id))
    });

    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
        <TrueCrimeTopicHub hub={hub} featuredEpisodes={featuredEpisodes} groupedSections={groupedSections} />
      </>
    );
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <DiscoveryHubPage routeKey="topics" hub={hub} />
    </>
  );
}
