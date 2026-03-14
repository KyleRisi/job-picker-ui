import type { Metadata } from 'next';
import { DiscoveryTermIndexPage } from '@/components/discovery-term-index-page';
import { listActiveDiscoveryTerms } from '@/lib/episodes';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Series | The Compendium Podcast',
  description: 'Browse every active Compendium series hub.',
  alternates: {
    canonical: '/series'
  }
};

export default async function DiscoverySeriesIndexPage() {
  const terms = (await listActiveDiscoveryTerms()).filter((term) => term.termType === 'series');
  return <DiscoveryTermIndexPage routeKey="series" terms={terms} />;
}
