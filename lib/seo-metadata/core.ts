import type { Metadata } from 'next';

export const DEFAULT_OG_IMAGE_PATH = '/The Compendium Main.jpg';
const DEFAULT_SITE_NAME = 'The Compendium Podcast';

type OpenGraphType = 'article' | 'website';

type BuildCanonicalAndSocialMetadataParams = {
  title: string;
  description?: string | null;
  canonicalCandidate?: string | null;
  fallbackPath: string;
  openGraphType: OpenGraphType;
  imageUrl?: string | null;
  imageAlt?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  siteName?: string;
  allowOffDomainCanonical?: boolean;
};

type CanonicalResolution = {
  metadataCanonical: string;
  absoluteCanonicalUrl: string;
};

type CanonicalResolver = (params: {
  candidateCanonical?: string | null;
  fallbackPath: string;
  siteUrl: string;
}) => CanonicalResolution;

function normalizeText(value: string | null | undefined): string {
  return `${value || ''}`.trim();
}

function isHttpProtocol(protocol: string): boolean {
  return protocol === 'http:' || protocol === 'https:';
}

function toRelativeIfSameOrigin(url: URL, siteOrigin: string): string {
  if (url.origin !== siteOrigin) return url.toString();
  const path = `${url.pathname || '/'}${url.search}${url.hash}`;
  return path || '/';
}

function toAbsoluteHttpUrl(value: string | null | undefined, siteUrl: string): string | null {
  const raw = normalizeText(value);
  if (!raw) return null;
  try {
    const parsed = new URL(raw, siteUrl);
    if (!isHttpProtocol(parsed.protocol)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function resolveCanonicalForMetadata(params: {
  siteUrl: string;
  canonicalCandidate?: string | null;
  fallbackPath: string;
  allowOffDomainCanonical?: boolean;
  resolveCanonical: CanonicalResolver;
}) {
  const site = new URL(params.siteUrl);
  const rawCandidate = normalizeText(params.canonicalCandidate);

  if (rawCandidate && params.allowOffDomainCanonical) {
    try {
      const parsed = new URL(rawCandidate, params.siteUrl);
      if (isHttpProtocol(parsed.protocol)) {
        return {
          metadataCanonical: toRelativeIfSameOrigin(parsed, site.origin),
          absoluteCanonicalUrl: parsed.toString()
        };
      }
    } catch {
      // Fall through to the default same-origin-safe canonical resolver.
    }
  }

  return params.resolveCanonical({
    candidateCanonical: rawCandidate || null,
    fallbackPath: params.fallbackPath,
    siteUrl: params.siteUrl
  });
}

export function buildCanonicalAndSocialMetadataFromContext(args: {
  params: BuildCanonicalAndSocialMetadataParams;
  siteUrl: string;
  resolveCanonical: CanonicalResolver;
}): Pick<Metadata, 'alternates' | 'openGraph' | 'twitter'> {
  const canonical = resolveCanonicalForMetadata({
    siteUrl: args.siteUrl,
    canonicalCandidate: args.params.canonicalCandidate,
    fallbackPath: args.params.fallbackPath,
    allowOffDomainCanonical: args.params.allowOffDomainCanonical,
    resolveCanonical: args.resolveCanonical
  });

  const normalizedTitle = normalizeText(args.params.title) || DEFAULT_SITE_NAME;
  const normalizedDescription = normalizeText(args.params.description) || undefined;
  const absoluteFallbackImage = toAbsoluteHttpUrl(DEFAULT_OG_IMAGE_PATH, args.siteUrl) || DEFAULT_OG_IMAGE_PATH;
  const absoluteOgImage = toAbsoluteHttpUrl(args.params.imageUrl, args.siteUrl) || absoluteFallbackImage;
  const imageAlt = normalizeText(args.params.imageAlt) || normalizedTitle;
  const twitterTitle = normalizeText(args.params.twitterTitle) || normalizedTitle;
  const twitterDescription = normalizeText(args.params.twitterDescription || args.params.description) || undefined;

  return {
    alternates: {
      canonical: canonical.metadataCanonical
    },
    openGraph: {
      title: normalizedTitle,
      description: normalizedDescription,
      url: canonical.absoluteCanonicalUrl,
      type: args.params.openGraphType,
      siteName: args.params.siteName || DEFAULT_SITE_NAME,
      images: [
        {
          url: absoluteOgImage,
          alt: imageAlt
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: twitterTitle,
      description: twitterDescription,
      images: [absoluteOgImage]
    }
  };
}

