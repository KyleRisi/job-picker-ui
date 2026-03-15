import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ROBOTS_NOINDEX_NOFOLLOW } from '@/lib/seo';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: 'Legacy Tag Archive Retired',
    robots: ROBOTS_NOINDEX_NOFOLLOW
  };
}

export default function BlogTagPage() {
  notFound();
}
