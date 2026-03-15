import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ROBOTS_NOINDEX_NOFOLLOW } from '@/lib/seo';
import { getTaxonomyRoutePolicy } from '@/lib/taxonomy-route-policy';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Legacy Category Archive Retired',
    robots: ROBOTS_NOINDEX_NOFOLLOW
  };
}

export default function BlogCategoryPage({ params }: { params: { categorySlug: string } }) {
  const route = `/blog/category/${params.categorySlug}`;
  const policy = getTaxonomyRoutePolicy(route);
  if (policy?.action === 'redirect_301' && policy.redirect_destination) {
    permanentRedirect(policy.redirect_destination);
  }
  notFound();
}
