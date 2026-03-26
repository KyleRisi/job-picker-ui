import type { Metadata } from 'next';
import { DiscoveryTermIndexPage } from '@/components/discovery-term-index-page';
import { listActiveDiscoveryTerms } from '@/lib/episodes';

export const revalidate = 300;

const TOPICS_TITLE = 'Podcast Topics | True Crime, History & Incredible People';
const TOPICS_DESCRIPTION =
  'Explore podcast topics including true crime, history and incredible people, then jump into curated hubs and hand-picked episode collections.';
const TOPICS_IMAGE = '/The Compendium Main.jpg';

export const metadata: Metadata = {
  title: {
    absolute: TOPICS_TITLE
  },
  description: TOPICS_DESCRIPTION,
  alternates: {
    canonical: '/topics'
  },
  openGraph: {
    title: TOPICS_TITLE,
    description: TOPICS_DESCRIPTION,
    url: '/topics',
    images: [
      {
        url: TOPICS_IMAGE,
        alt: 'The Compendium Podcast topic hubs'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: TOPICS_TITLE,
    description: TOPICS_DESCRIPTION,
    images: [TOPICS_IMAGE]
  }
};

export default async function TopicsIndexPage() {
  const terms = (await listActiveDiscoveryTerms()).filter((term) => term.termType === 'topic' && term.path);
  return <DiscoveryTermIndexPage routeKey="topics" terms={terms} />;
}
