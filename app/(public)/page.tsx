import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { HomepageV1, homepageV1Metadata } from '@/components/home/homepage-v1';
import { HomepageV2, homepageV2Metadata } from '@/components/home/homepage-v2';
import {
  normalizeHost,
  resolveHomepageV2EnvironmentFromHost,
  shouldServeHomepageV2AtRoot
} from '@/lib/homepage-v2/env';

type SearchParamMap = Record<string, string | string[] | undefined>;

// Keep homepage swap logic runtime-evaluated so launch toggles cannot be baked into a static build.
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  if (shouldServeHomepageV2AtRoot()) return homepageV2Metadata;
  return homepageV1Metadata;
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: SearchParamMap;
}) {
  if (!shouldServeHomepageV2AtRoot()) {
    return <HomepageV1 />;
  }

  const host = normalizeHost(headers().get('host') || '');
  const environment = resolveHomepageV2EnvironmentFromHost(host);

  return <HomepageV2 environment={environment} pagePath="/" searchParams={searchParams} />;
}
