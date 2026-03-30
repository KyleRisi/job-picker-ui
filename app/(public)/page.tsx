import type { Metadata } from 'next';
import { HomepageV2, homepageV2Metadata } from '@/components/home/homepage-v2';
import { type HomepageV2Environment } from '@/lib/homepage-v2/env';

const HOMEPAGE_ENVIRONMENT: HomepageV2Environment = 'production';

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  return homepageV2Metadata;
}

export default async function HomePage() {
  return <HomepageV2 environment={HOMEPAGE_ENVIRONMENT} pagePath="/" />;
}
