import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ROBOTS_NOINDEX_NOFOLLOW } from '@/lib/seo';
import { getTaxonomyRoutePolicy } from '@/lib/taxonomy-route-policy';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Legacy Topic Archive Retired',
    robots: ROBOTS_NOINDEX_NOFOLLOW
  };
}

export default function BlogTopicPage({ params }: { params: { topicSlug: string } }) {
  const route = `/blog/topic/${params.topicSlug}`;
  const policy = getTaxonomyRoutePolicy(route);
  if (policy?.action === 'redirect_301' && policy.redirect_destination) {
    permanentRedirect(policy.redirect_destination);
  }
  notFound();
}
