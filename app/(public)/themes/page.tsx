import type { Metadata } from 'next';
import { DiscoveryTermIndexPage } from '@/components/discovery-term-index-page';
import { listActiveDiscoveryTerms } from '@/lib/episodes';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Themes | The Compendium Podcast',
  description: 'Browse every active Compendium theme hub.',
  alternates: {
    canonical: '/themes'
  }
};

export default async function ThemesIndexPage() {
  const terms = (await listActiveDiscoveryTerms()).filter((term) => term.termType === 'theme');
  return <DiscoveryTermIndexPage routeKey="themes" terms={terms} />;
}
