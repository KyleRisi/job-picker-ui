import type { Metadata } from 'next';
import { DiscoveryTermIndexPage } from '@/components/discovery-term-index-page';
import { listActiveDiscoveryTerms } from '@/lib/episodes';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'People | The Compendium Podcast',
  description: 'Browse every active Compendium people hub.'
};

export default async function PeopleIndexPage() {
  const terms = (await listActiveDiscoveryTerms()).filter((term) => term.termType === 'entity' && term.entitySubtype === 'person');
  return <DiscoveryTermIndexPage routeKey="people" terms={terms} />;
}
