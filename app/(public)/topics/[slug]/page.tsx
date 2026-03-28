import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DiscoveryHubPage } from '@/components/discovery-hub-page';
import { TopicHubLayout } from '@/components/topic-hub/topic-hub-layout';
import { breadcrumbsToJsonLd } from '@/lib/breadcrumbs';
import { buildHubBreadcrumbs, getDiscoveryHubPage } from '@/lib/episodes';
import { compactJsonLd, getPageEntityIds, resolveCanonicalForSchema } from '@/lib/schema-jsonld';
import { getPublicSiteUrl } from '@/lib/site-url';
import { buildCanonicalAndSocialMetadata } from '@/lib/seo-metadata';
import { getTopicHubConfig } from '@/lib/topic-hub/topic-hub-config';
import {
  buildTopicEditorialGroups,
  buildTopicFeaturedSelection
} from '@/lib/topic-hub/topic-hub-curation';
import { getConfiguredTopicHubData } from '@/lib/topic-hub/topic-hub-data';

export const revalidate = 300;

type Params = {
  slug: string;
};

type SearchParams = {
  page?: string | string[];
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const topicHubConfig = getTopicHubConfig(params.slug);
  const fallbackPath = `/topics/${params.slug}`;

  if (topicHubConfig?.seoOverride) {
    const socialTitle = topicHubConfig.seoOverride.socialTitle || topicHubConfig.seoOverride.titleAbsolute;
    const socialDescription = topicHubConfig.seoOverride.socialDescription || topicHubConfig.seoOverride.description;
    const socialImageUrl = topicHubConfig.seoOverride.socialImageUrl || '/The Compendium Main.jpg';
    const socialMetadata = buildCanonicalAndSocialMetadata({
      title: socialTitle,
      description: socialDescription,
      twitterTitle: socialTitle,
      twitterDescription: socialDescription,
      canonicalCandidate: fallbackPath,
      fallbackPath,
      openGraphType: 'website',
      imageUrl: socialImageUrl,
      imageAlt: socialTitle
    });

    return {
      title: {
        absolute: topicHubConfig.seoOverride.titleAbsolute
      },
      description: topicHubConfig.seoOverride.description,
      ...socialMetadata
    };
  }

  const hub = await getDiscoveryHubPage('topics', params.slug);
  if (!hub) {
    return {
      title: 'Topic Not Found | The Compendium Podcast',
      robots: {
        index: false,
        follow: false
      }
    };
  }

  const title = `${hub.term.seoTitle || hub.term.name} | Topics`;
  const description = hub.term.metaDescription || hub.term.description || `Explore episodes in ${hub.term.name}.`;
  const socialMetadata = buildCanonicalAndSocialMetadata({
    title,
    description,
    twitterTitle: title,
    twitterDescription: description,
    canonicalCandidate: fallbackPath,
    fallbackPath,
    openGraphType: 'website',
    imageAlt: title
  });

  return {
    title,
    description,
    ...socialMetadata
  };
}

export default async function TopicHubPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const topicHubConfig = getTopicHubConfig(params.slug);
  if (topicHubConfig) {
    const configuredTopicHubData = await getConfiguredTopicHubData(params.slug);
    if (!configuredTopicHubData) notFound();

    const hub = configuredTopicHubData.hub;
    const topicEpisodes = configuredTopicHubData.topicEpisodes;

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

    const featuredEpisodes = buildTopicFeaturedSelection(topicEpisodes, topicHubConfig.curation.featuredEpisodeSlugs);
    const groupedSections = buildTopicEditorialGroups({
      episodes: topicEpisodes,
      featuredEpisodeIds: new Set(featuredEpisodes.map((episode) => episode.id)),
      sectionConfigs: topicHubConfig.curation.editorialSections
    });

    return (
      <>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
        <TopicHubLayout
          hub={hub}
          featuredEpisodes={featuredEpisodes}
          groupedSections={groupedSections}
          config={topicHubConfig.layout}
        />
      </>
    );
  }

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

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <DiscoveryHubPage routeKey="topics" hub={hub} />
    </>
  );
}
