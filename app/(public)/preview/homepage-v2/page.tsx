import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { HomepageV2, homepageV2Metadata } from '@/components/home/homepage-v2';
import { ROBOTS_NOINDEX_NOFOLLOW } from '@/lib/seo';
import {
  isHomepageV2CanonicalHost,
  isHomepageV2PreviewHostAllowed,
  normalizeHost,
  preferredProtocolForHost,
  resolveHomepageV2EnvironmentFromHost
} from '@/lib/homepage-v2/env';

type SearchParamMap = Record<string, string | string[] | undefined>;

function resolvePreviewCanonical(host: string): string | null {
  if (!host) return null;
  if (!isHomepageV2PreviewHostAllowed(host)) return null;
  if (isHomepageV2CanonicalHost(host)) return null;
  return `${preferredProtocolForHost(host)}://${host}/preview/homepage-v2`;
}

export async function generateMetadata(): Promise<Metadata> {
  const host = normalizeHost(headers().get('host') || '');
  const canonical = resolvePreviewCanonical(host);

  return {
    ...homepageV2Metadata,
    title: 'Homepage V2 Preview | The Compendium Podcast',
    robots: ROBOTS_NOINDEX_NOFOLLOW,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      ...homepageV2Metadata.openGraph,
      url: canonical || undefined
    }
  };
}

export default async function HomepageV2PreviewPage({
  searchParams
}: {
  searchParams?: SearchParamMap;
}) {
  const host = normalizeHost(headers().get('host') || '');
  if (!host) notFound();
  if (!isHomepageV2PreviewHostAllowed(host)) notFound();
  if (isHomepageV2CanonicalHost(host)) notFound();

  const environment = resolveHomepageV2EnvironmentFromHost(host);

  return <HomepageV2 environment={environment} pagePath="/preview/homepage-v2" searchParams={searchParams} />;
}
