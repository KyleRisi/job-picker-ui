import 'server-only';

import { getPublicSiteUrl } from '@/lib/site-url';

type JsonValue = string | number | boolean | null | undefined | JsonValue[] | { [key: string]: JsonValue };

export type CanonicalResolution = {
  metadataCanonical: string;
  absoluteCanonicalUrl: string;
  offDomainCandidate: string | null;
};

function isHttpUrl(value: URL) {
  return value.protocol === 'http:' || value.protocol === 'https:';
}

function toRelativeCanonical(url: URL, siteOrigin: string) {
  if (url.origin !== siteOrigin) return url.toString();
  const path = `${url.pathname || '/'}${url.search}${url.hash}`;
  return path || '/';
}

export function toAbsoluteSchemaUrl(value: string | null | undefined, siteUrl = getPublicSiteUrl()): string | null {
  const raw = `${value || ''}`.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw, siteUrl);
    if (!isHttpUrl(parsed)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function resolveCanonicalForSchema(params: {
  candidateCanonical?: string | null;
  fallbackPath: string;
  siteUrl?: string;
}) : CanonicalResolution {
  const siteUrl = params.siteUrl || getPublicSiteUrl();
  const site = new URL(siteUrl);
  const fallbackAbsolute = toAbsoluteSchemaUrl(params.fallbackPath, siteUrl) || `${site.origin}${params.fallbackPath.startsWith('/') ? params.fallbackPath : `/${params.fallbackPath}`}`;
  const fallback = new URL(fallbackAbsolute);
  const raw = `${params.candidateCanonical || ''}`.trim();

  if (!raw) {
    return {
      metadataCanonical: toRelativeCanonical(fallback, site.origin),
      absoluteCanonicalUrl: fallback.toString(),
      offDomainCandidate: null
    };
  }

  try {
    const parsed = new URL(raw, siteUrl);
    if (!isHttpUrl(parsed)) throw new Error('Unsupported canonical protocol');
    if (parsed.origin !== site.origin) {
      return {
        metadataCanonical: toRelativeCanonical(fallback, site.origin),
        absoluteCanonicalUrl: fallback.toString(),
        offDomainCandidate: parsed.toString()
      };
    }
    return {
      metadataCanonical: toRelativeCanonical(parsed, site.origin),
      absoluteCanonicalUrl: parsed.toString(),
      offDomainCandidate: null
    };
  } catch {
    return {
      metadataCanonical: toRelativeCanonical(fallback, site.origin),
      absoluteCanonicalUrl: fallback.toString(),
      offDomainCandidate: null
    };
  }
}

export function compactJsonLd<T>(value: T): T {
  if (Array.isArray(value)) {
    const next = value
      .map((entry) => compactJsonLd(entry as JsonValue))
      .filter((entry) => {
        if (entry === null || entry === undefined) return false;
        if (typeof entry === 'string') return entry.trim().length > 0;
        if (Array.isArray(entry)) return entry.length > 0;
        if (typeof entry === 'object') return Object.keys(entry).length > 0;
        return true;
      });
    return next as T;
  }

  if (value && typeof value === 'object') {
    const next: Record<string, JsonValue> = {};
    Object.entries(value as Record<string, JsonValue>).forEach(([key, entry]) => {
      if (entry === null || entry === undefined) return;
      if (typeof entry === 'string' && entry.trim().length === 0) return;
      const compacted = compactJsonLd(entry);
      if (compacted === null || compacted === undefined) return;
      if (typeof compacted === 'string' && compacted.trim().length === 0) return;
      if (Array.isArray(compacted) && compacted.length === 0) return;
      if (typeof compacted === 'object' && !Array.isArray(compacted) && Object.keys(compacted).length === 0) return;
      next[key] = compacted;
    });
    return next as T;
  }

  return value;
}

export function getSiteEntityIds(siteUrl = getPublicSiteUrl()) {
  const absolute = (toAbsoluteSchemaUrl(siteUrl, siteUrl) || siteUrl).replace(/\/+$/, '');
  return {
    organization: `${absolute}/#organization`,
    website: `${absolute}/#website`,
    podcastSeries: `${absolute}/#podcast-series`
  };
}

export function getPageEntityIds(absoluteCanonicalUrl: string) {
  return {
    breadcrumb: `${absoluteCanonicalUrl}#breadcrumb`,
    podcastEpisode: `${absoluteCanonicalUrl}#podcast-episode`,
    blogPosting: `${absoluteCanonicalUrl}#blog-posting`
  };
}
