import type { Metadata } from 'next';
import { DiscoveryTermIndexPage } from '@/components/discovery-term-index-page';
import { listActiveDiscoveryTerms } from '@/lib/episodes';
import { getHubIndexSeo } from '@/lib/seo-page-copy';

export const revalidate = 300;

const seo = getHubIndexSeo('collections');

export const metadata: Metadata = {
  title: seo.title,
  description: seo.description,
  alternates: {
    canonical: '/collections'
  }
};

export default async function CollectionsIndexPage() {
  const terms = (await listActiveDiscoveryTerms()).filter((term) => term.termType === 'collection' && term.path);
  return <DiscoveryTermIndexPage routeKey="collections" terms={terms} />;
}
