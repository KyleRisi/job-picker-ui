import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DiscoveryHubPage } from '@/components/discovery-hub-page';
import { getDiscoveryHubPage } from '@/lib/episodes';

export const revalidate = 300;

type Params = {
  slug: string;
};

type SearchParams = {
  page?: string | string[];
};

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const hub = await getDiscoveryHubPage('series', params.slug);

  if (!hub) {
    return {
      title: 'Series Not Found | The Compendium Podcast',
      robots: {
        index: false,
        follow: false
      }
    };
  }

  return {
    title: `${hub.term.seoTitle || hub.term.name} | Series | The Compendium Podcast`,
    description: hub.term.metaDescription || hub.term.description || `Explore episodes in ${hub.term.name}.`
  };
}

export default async function SeriesHubPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const rawPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const parsedPage = Number.parseInt(`${rawPage || '1'}`, 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const hub = await getDiscoveryHubPage('series', params.slug, page);
  if (!hub) notFound();

  return <DiscoveryHubPage routeKey="series" hub={hub} />;
}
