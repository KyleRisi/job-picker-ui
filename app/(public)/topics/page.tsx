import type { Metadata } from 'next';
import { DiscoveryTermIndexPage } from '@/components/discovery-term-index-page';
import { listActiveDiscoveryTerms } from '@/lib/episodes';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Topics | The Compendium Podcast',
  description: 'Browse every active Compendium topic hub.',
  alternates: {
    canonical: '/topics'
  }
};

export default async function TopicsIndexPage() {
  const terms = (await listActiveDiscoveryTerms()).filter((term) => term.termType === 'topic' && term.path);
  return <DiscoveryTermIndexPage routeKey="topics" terms={terms} />;
}
