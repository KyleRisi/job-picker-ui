import type { Metadata } from 'next';
import { ROBOTS_NOINDEX_NOFOLLOW } from '@/lib/seo';

export const metadata: Metadata = {
  robots: ROBOTS_NOINDEX_NOFOLLOW
};

export default function ApplyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
