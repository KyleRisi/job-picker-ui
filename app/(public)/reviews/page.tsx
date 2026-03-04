import type { Metadata } from 'next';
import { ReviewsPage } from '@/components/reviews-page';
import { getVisibleReviews } from '@/lib/reviews';

export const metadata: Metadata = {
  title: 'Listener Reviews | The Compendium Podcast',
  description:
    'Read what listeners around the world are saying about The Compendium Podcast, and leave your own review.',
  alternates: { canonical: '/reviews' },
  openGraph: {
    title: 'Listener Reviews | The Compendium Podcast',
    description:
      'Read what listeners around the world are saying about The Compendium Podcast, and leave your own review.',
    url: '/reviews',
  },
};

export default async function Page() {
  const reviews = await getVisibleReviews();
  return <ReviewsPage initialReviews={reviews} />;
}
