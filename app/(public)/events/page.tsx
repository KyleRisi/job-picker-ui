import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ROBOTS_NOINDEX_NOFOLLOW } from '@/lib/seo';

export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Events Archive Retired',
  robots: ROBOTS_NOINDEX_NOFOLLOW
};

export default function EventsIndexPage() {
  notFound();
}
