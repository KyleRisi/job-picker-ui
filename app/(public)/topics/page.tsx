import type { Metadata } from 'next';
import { DiscoveryTermIndexPage } from '@/components/discovery-term-index-page';
import { listActiveDiscoveryTerms } from '@/lib/episodes';
import { buildCanonicalAndSocialMetadata } from '@/lib/seo-metadata';

export const revalidate = 300;

const TOPICS_TITLE = 'Podcast Topics | True Crime, History & Incredible People';
const TOPICS_DESCRIPTION =
  'Explore podcast topics including true crime, history and incredible people, then jump into curated hubs and hand-picked episode collections.';
const TOPICS_IMAGE = '/The Compendium Main.jpg';
const topicsSocialMetadata = buildCanonicalAndSocialMetadata({
  title: TOPICS_TITLE,
  description: TOPICS_DESCRIPTION,
  twitterTitle: TOPICS_TITLE,
  twitterDescription: TOPICS_DESCRIPTION,
  canonicalCandidate: '/topics',
  fallbackPath: '/topics',
  openGraphType: 'website',
  imageUrl: TOPICS_IMAGE,
  imageAlt: 'The Compendium Podcast topic hubs'
});

export const metadata: Metadata = {
  title: {
    absolute: TOPICS_TITLE
  },
  description: TOPICS_DESCRIPTION,
  ...topicsSocialMetadata
};

export default async function TopicsIndexPage() {
  const terms = (await listActiveDiscoveryTerms()).filter((term) => term.termType === 'topic' && term.path);
  return <DiscoveryTermIndexPage routeKey="topics" terms={terms} />;
}
