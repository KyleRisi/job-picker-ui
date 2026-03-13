import type { Metadata } from 'next';
import { DiscoveryTermIndexPage } from '@/components/discovery-term-index-page';
import { listActiveDiscoveryTerms } from '@/lib/episodes';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Cases | The Compendium Podcast',
  description: 'Browse every active Compendium case hub.'
};

export default async function CasesIndexPage() {
  const terms = (await listActiveDiscoveryTerms()).filter((term) => term.termType === 'case');
  return <DiscoveryTermIndexPage routeKey="cases" terms={terms} />;
}
