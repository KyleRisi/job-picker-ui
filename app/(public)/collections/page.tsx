import type { Metadata } from 'next';
import { DiscoveryTermIndexPage } from '@/components/discovery-term-index-page';
import { listActiveDiscoveryTerms } from '@/lib/episodes';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Collections | The Compendium Podcast',
  description: 'Browse every active Compendium collection hub.'
};

export default async function CollectionsIndexPage() {
  const terms = (await listActiveDiscoveryTerms()).filter((term) => term.termType === 'collection');
  return <DiscoveryTermIndexPage routeKey="collections" terms={terms} />;
}
