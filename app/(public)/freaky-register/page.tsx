import type { Metadata } from 'next';
import { FreakyRegisterPage } from '@/components/freaky-register-page';
import { listFreakySuggestions } from '@/lib/freaky';
import { ROBOTS_NOINDEX_NOFOLLOW } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Freaky Register',
  description: 'Suggest episode ideas and back topics you want covered by The Compendium Podcast.',
  alternates: { canonical: '/freaky-register' },
  robots: ROBOTS_NOINDEX_NOFOLLOW,
  openGraph: {
    title: 'Freaky Register | The Compendium Podcast',
    description: 'Suggest an episode topic and upvote the stories you want us to cover.',
    url: '/freaky-register'
  }
};

export default async function FreakyRegisterRoute() {
  const initial = await listFreakySuggestions({ bucket: 'open', sort: 'top', limit: 20, offset: 0 });
  return <FreakyRegisterPage initialSuggestions={initial.openItems} initialHasMore={initial.hasMoreOpen} />;
}
