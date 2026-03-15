import type { Metadata } from 'next';
import { DiscoveryTermIndexPage } from '@/components/discovery-term-index-page';
import { listActiveDiscoveryTerms } from '@/lib/episodes';
import { getHubIndexSeo } from '@/lib/seo-page-copy';

export const revalidate = 300;

const seo = getHubIndexSeo('topics');

export const metadata: Metadata = {
  title: seo.title,
  description: seo.description,
  alternates: {
    canonical: '/topics'
  }
};

export default async function TopicsIndexPage() {
  const terms = (await listActiveDiscoveryTerms()).filter((term) => term.termType === 'topic' && term.path);
  return <DiscoveryTermIndexPage routeKey="topics" terms={terms} />;
}
