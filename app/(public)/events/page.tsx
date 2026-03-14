import type { Metadata } from 'next';
import { DiscoveryTermIndexPage } from '@/components/discovery-term-index-page';
import { listActiveDiscoveryTerms } from '@/lib/episodes';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Events | The Compendium Podcast',
  description: 'Browse every active Compendium event hub.'
};

export default async function EventsIndexPage() {
  const terms = (await listActiveDiscoveryTerms()).filter((term) => term.termType === 'event');
  return <DiscoveryTermIndexPage routeKey="events" terms={terms} />;
}
