import type { Metadata } from 'next';
import { ReviewsPage } from '@/components/reviews-page';
import { getVisibleReviewsPage } from '@/lib/reviews';

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

type SearchParams = {
  page?: string | string[];
};

const REVIEWS_PAGE_SIZE = 12;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const rawPage = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const parsedPage = Number.parseInt(`${rawPage || '1'}`, 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const { reviews, pagination } = await getVisibleReviewsPage(page, REVIEWS_PAGE_SIZE);

  return <ReviewsPage initialReviews={reviews} pagination={pagination} />;
}
