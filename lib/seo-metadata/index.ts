import 'server-only';

import type { Metadata } from 'next';
import { resolveCanonicalForSchema } from '@/lib/schema-jsonld';
import { getPublicSiteUrl } from '@/lib/site-url';
import { DEFAULT_OG_IMAGE_PATH, buildCanonicalAndSocialMetadataFromContext } from '@/lib/seo-metadata/core';
export { DEFAULT_OG_IMAGE_PATH } from '@/lib/seo-metadata/core';

type BuildCanonicalAndSocialMetadataParams = Parameters<typeof buildCanonicalAndSocialMetadataFromContext>[0]['params'];

export function buildCanonicalAndSocialMetadata(
  params: BuildCanonicalAndSocialMetadataParams
): Pick<Metadata, 'alternates' | 'openGraph' | 'twitter'> {
  const siteUrl = getPublicSiteUrl();

  return buildCanonicalAndSocialMetadataFromContext({
    params,
    siteUrl,
    resolveCanonical: ({ candidateCanonical, fallbackPath, siteUrl: resolveSiteUrl }) => {
      const canonical = resolveCanonicalForSchema({
        candidateCanonical,
        fallbackPath,
        siteUrl: resolveSiteUrl
      });
      return {
        metadataCanonical: canonical.metadataCanonical,
        absoluteCanonicalUrl: canonical.absoluteCanonicalUrl
      };
    }
  });
}
