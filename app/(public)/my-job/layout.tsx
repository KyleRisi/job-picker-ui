import type { Metadata } from 'next';
import { ROBOTS_NOINDEX_NOFOLLOW } from '@/lib/seo';

export const metadata: Metadata = {
  robots: ROBOTS_NOINDEX_NOFOLLOW
};

export default function MyJobLayout({ children }: { children: React.ReactNode }) {
  return children;
}
