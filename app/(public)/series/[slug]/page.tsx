import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { ROBOTS_NOINDEX_NOFOLLOW } from '@/lib/seo';
import { getTaxonomyRoutePolicy } from '@/lib/taxonomy-route-policy';

export const revalidate = 300;

type Params = {
  slug: string;
};

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Series Archive Retired',
    robots: ROBOTS_NOINDEX_NOFOLLOW
  };
}

export default function SeriesHubPage({ params }: { params: Params }) {
  const route = `/series/${params.slug}`;
  const policy = getTaxonomyRoutePolicy(route);
  if (policy?.action === 'redirect_301' && policy.redirect_destination) {
    permanentRedirect(policy.redirect_destination);
  }
  notFound();
}
