import { NextRequest, NextResponse } from 'next/server';
import { buildRedirectLocation, normalizePath, shouldSkipRedirectLookup } from '@/lib/redirects';
import { getTaxonomyRoutePolicy } from '@/lib/taxonomy-route-policy';
import {
  isHomepageV2CanonicalHost,
  isHomepageV2NetlifyPreviewHost,
  isHomepageV2PreviewHostAllowed,
  normalizeHost
} from '@/lib/homepage-v2/env';

type ResolveItem = {
  id: string;
  source_path: string;
  target_url: string | null;
  status_code: 301 | 302 | 307 | 308 | 410;
  match_type: 'exact' | 'prefix';
  priority: number;
};

type CacheEntry = {
  expiresAt: number;
  item: ResolveItem | null;
};

const LOOKUP_TIMEOUT_MS = 350;
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();
const DEFAULT_REDIRECT_LOOKUP_PREFIXES = [
  '/episode',
  '/podcast',
  '/topics',
  '/themes',
  '/people',
  '/cases',
  '/events',
  '/collections',
  '/series',
  '/blog/author',
  '/blog/tag',
  '/blog/series',
  '/blog/topic',
  '/blog/label'
];
const REDIRECT_LOOKUP_PREFIXES = (() => {
  const raw = `${process.env.REDIRECT_LOOKUP_PREFIXES || ''}`.trim();
  const source = raw
    ? raw.split(',').map((value) => normalizePath(value)).filter((value) => value !== '/')
    : DEFAULT_REDIRECT_LOOKUP_PREFIXES;
  return [...new Set(source)];
})();
const REDIRECT_LOOKUP_EXACT_PATHS = new Set(['/about']);
const REDIRECT_LOOKUP_LOG_EVERY = Number.parseInt(process.env.REDIRECT_LOOKUP_LOG_EVERY || '250', 10);
const redirectLookupStats = {
  skippedByPattern: 0,
  cacheHits: 0,
  cacheMisses: 0,
  remoteCalls: 0,
  remoteHits: 0,
  remoteMisses: 0,
  remoteErrors: 0
};
const HOMEPAGE_V2_PREVIEW_PATH = '/preview/homepage-v2';
const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy-report-only':
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; frame-src 'self' https://app.netlify.com"
};

function shouldNoindexHost(req: NextRequest): boolean {
  const host = normalizeHost(req.headers.get('host') || '');
  if (!host) return false;
  if (isHomepageV2CanonicalHost(host)) return false;
  if (isHomepageV2PreviewHostAllowed(host)) return true;
  return isHomepageV2NetlifyPreviewHost(host);
}

function withConditionalNoindex(req: NextRequest, response: NextResponse): NextResponse {
  if (shouldNoindexHost(req)) {
    response.headers.set('x-robots-tag', 'noindex, nofollow');
  }
  return response;
}

function withSecurityHeaders(req: NextRequest, response: NextResponse): NextResponse {
  if (process.env.NODE_ENV !== 'production') return response;
  if (shouldNoindexHost(req)) return response;
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(name, value);
  }
  return response;
}

function withBaselineHeaders(req: NextRequest, response: NextResponse): NextResponse {
  return withSecurityHeaders(req, withConditionalNoindex(req, response));
}

function withHomepageV2Noindex(response: NextResponse): NextResponse {
  response.headers.set('x-robots-tag', 'noindex, nofollow');
  return response;
}

function decodeBasicAuthHeader(value: string): { username: string; password: string } | null {
  if (!value || !value.startsWith('Basic ')) return null;
  try {
    const encoded = value.slice('Basic '.length).trim();
    const decoded = atob(encoded);
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex < 0) return null;
    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1)
    };
  } catch {
    return null;
  }
}

function isHomepageV2PreviewAuthorized(req: NextRequest): boolean {
  const expectedUser = `${process.env.HOMEPAGE_V2_PREVIEW_USER || ''}`;
  const expectedPass = `${process.env.HOMEPAGE_V2_PREVIEW_PASS || ''}`;

  if (!expectedUser && !expectedPass) return true;

  const parsed = decodeBasicAuthHeader(req.headers.get('authorization') || '');
  if (!parsed) return false;

  return parsed.username === expectedUser && parsed.password === expectedPass;
}

function readFromCache(path: string): ResolveItem | null | undefined {
  const existing = cache.get(path);
  if (!existing) return undefined;
  if (Date.now() > existing.expiresAt) {
    cache.delete(path);
    return undefined;
  }
  return existing.item;
}

function writeToCache(path: string, item: ResolveItem | null) {
  if (cache.size > 5000) cache.clear();
  cache.set(path, { item, expiresAt: Date.now() + CACHE_TTL_MS });
}

function incrementRedirectLookupStat(name: keyof typeof redirectLookupStats) {
  redirectLookupStats[name] += 1;
  const total = Object.values(redirectLookupStats).reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(REDIRECT_LOOKUP_LOG_EVERY) || REDIRECT_LOOKUP_LOG_EVERY < 1) return;
  if (total % REDIRECT_LOOKUP_LOG_EVERY !== 0) return;
  console.info('[redirect lookup stats]', JSON.stringify({
    ...redirectLookupStats,
    cacheSize: cache.size
  }));
}

function shouldAttemptDynamicRedirectLookup(pathname: string): boolean {
  if (REDIRECT_LOOKUP_EXACT_PATHS.has(pathname)) return true;
  return REDIRECT_LOOKUP_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function normalizeEpisodeSlugCandidate(value: string): string {
  let decoded = value || '';
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep raw value when malformed escapes are present.
  }

  return decoded
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

function getDeterministicLegacyEpisodeTarget(pathname: string): string | null {
  const numberedEpisodePath = pathname.match(/^\/episodes\/episode-\d+-(.+)$/);
  if (numberedEpisodePath?.[1]) {
    const slug = normalizeEpisodeSlugCandidate(numberedEpisodePath[1]);
    if (slug) return `/episodes/${slug}`;
  }

  const singularEpisodePath = pathname.match(/^\/episode\/(.+)$/);
  if (singularEpisodePath?.[1]) {
    const slug = normalizeEpisodeSlugCandidate(singularEpisodePath[1]);
    if (slug) return `/episodes/${slug}`;
  }

  const podcastLegacyPath = pathname.match(/^\/podcast\/the-compendium-of-fascinating-things\/episode\/(.+)$/);
  if (podcastLegacyPath?.[1]) {
    const slug = normalizeEpisodeSlugCandidate(podcastLegacyPath[1]);
    if (slug) return `/episodes/${slug}`;
  }

  return null;
}

async function resolveRedirect(req: NextRequest, normalizedPath: string): Promise<ResolveItem | null> {
  const cached = readFromCache(normalizedPath);
  if (cached !== undefined) {
    incrementRedirectLookupStat('cacheHits');
    return cached;
  }
  incrementRedirectLookupStat('cacheMisses');

  const secret = process.env.REDIRECT_RESOLVE_SECRET || '';
  if (!secret) {
    console.error('[redirect resolve] REDIRECT_RESOLVE_SECRET is missing; skipping dynamic redirect lookup.');
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const url = new URL('/api/internal/redirects/resolve', req.url);
    url.searchParams.set('path', normalizedPath);
    incrementRedirectLookupStat('remoteCalls');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-redirect-resolve-secret': secret
      },
      cache: 'no-store',
      signal: controller.signal
    });

    if (!response.ok) {
      incrementRedirectLookupStat('remoteErrors');
      return null;
    }

    const payload = (await response.json()) as { item?: ResolveItem | null };
    const item = payload.item || null;
    writeToCache(normalizedPath, item);
    if (item) {
      incrementRedirectLookupStat('remoteHits');
    } else {
      incrementRedirectLookupStat('remoteMisses');
    }
    return item;
  } catch {
    incrementRedirectLookupStat('remoteErrors');
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function middleware(req: NextRequest) {
  const normalizedPath = normalizePath(req.nextUrl.pathname);
  const isAuthorRoute = normalizedPath === '/author' || normalizedPath.startsWith('/author/');
  const middlewareStart = performance.now();
  const serverTiming: string[] = [];
  const markTiming = (name: string, startedAt: number) => {
    if (!isAuthorRoute) return;
    serverTiming.push(`${name};dur=${(performance.now() - startedAt).toFixed(1)}`);
  };
  const finalize = (response: NextResponse) => {
    const nextResponse = withBaselineHeaders(req, response);
    if (!isAuthorRoute) return nextResponse;
    const total = `mw_total;dur=${(performance.now() - middlewareStart).toFixed(1)}`;
    const value = [...serverTiming, total].join(', ');
    if (value) {
      const existing = nextResponse.headers.get('server-timing');
      nextResponse.headers.set('server-timing', existing ? `${existing}, ${value}` : value);
    }
    return nextResponse;
  };

  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return finalize(NextResponse.next());

  if (normalizedPath === HOMEPAGE_V2_PREVIEW_PATH) {
    const host = normalizeHost(req.headers.get('host') || '');
    const rejectWithNotFound = () => finalize(withHomepageV2Noindex(new NextResponse('Not Found', { status: 404 })));

    if (!host) return rejectWithNotFound();
    if (isHomepageV2CanonicalHost(host)) return rejectWithNotFound();
    if (!isHomepageV2PreviewHostAllowed(host)) return rejectWithNotFound();

    if (!isHomepageV2PreviewAuthorized(req)) {
      const unauthorized = new NextResponse('Authentication required.', { status: 401 });
      unauthorized.headers.set('WWW-Authenticate', 'Basic realm=\"Homepage V2 Preview\", charset=\"UTF-8\"');
      return finalize(withHomepageV2Noindex(unauthorized));
    }

    return finalize(withHomepageV2Noindex(NextResponse.next()));
  }

  if (normalizedPath === '/') return finalize(NextResponse.next());
  if (shouldSkipRedirectLookup(normalizedPath)) return finalize(NextResponse.next());

  const taxonomyStart = performance.now();
  const taxonomyRoutePolicy = getTaxonomyRoutePolicy(normalizedPath);
  markTiming('mw_taxonomy', taxonomyStart);
  if (taxonomyRoutePolicy?.action === 'gone_410') {
    return finalize(new NextResponse('Gone', { status: 410 }));
  }
  if (taxonomyRoutePolicy?.action === 'redirect_301' && taxonomyRoutePolicy.redirect_destination) {
    const destination = buildRedirectLocation({
      requestUrl: req.nextUrl,
      requestPath: normalizedPath,
      sourcePath: normalizedPath,
      targetUrl: taxonomyRoutePolicy.redirect_destination,
      matchType: 'exact',
      preserveQuery: true
    });
    const destinationUrl = new URL(destination);
    if (destinationUrl.toString() !== req.nextUrl.toString()) {
      return finalize(NextResponse.redirect(destinationUrl, 301));
    }
  }
  if (taxonomyRoutePolicy?.action === 'live_noindex') {
    const response = finalize(NextResponse.next());
    response.headers.set('x-robots-tag', 'noindex, follow');
    return response;
  }
  if (!shouldAttemptDynamicRedirectLookup(normalizedPath)) {
    incrementRedirectLookupStat('skippedByPattern');
    return finalize(NextResponse.next());
  }

  const redirectLookupStart = performance.now();
  const match = await resolveRedirect(req, normalizedPath);
  markTiming('mw_redirect_lookup', redirectLookupStart);
  if (!match) {
    const deterministicEpisodeTarget = getDeterministicLegacyEpisodeTarget(normalizedPath);
    if (deterministicEpisodeTarget && deterministicEpisodeTarget !== normalizedPath) {
      const destination = buildRedirectLocation({
        requestUrl: req.nextUrl,
        requestPath: normalizedPath,
        sourcePath: normalizedPath,
        targetUrl: deterministicEpisodeTarget,
        matchType: 'exact',
        preserveQuery: true
      });
      return finalize(NextResponse.redirect(new URL(destination), 301));
    }

    return finalize(NextResponse.next());
  }
  if (match.status_code === 410) {
    return finalize(new NextResponse('Gone', { status: 410 }));
  }
  if (!match.target_url) {
    return finalize(NextResponse.next());
  }

  const destination = buildRedirectLocation({
    requestUrl: req.nextUrl,
    requestPath: normalizedPath,
    sourcePath: match.source_path,
    targetUrl: match.target_url,
    matchType: match.match_type,
    preserveQuery: true
  });

  const destinationUrl = new URL(destination);
  if (destinationUrl.toString() === req.nextUrl.toString()) {
    return finalize(NextResponse.next());
  }

  return finalize(NextResponse.redirect(destinationUrl, match.status_code));
}

export const config = {
  matcher: [
    // Skip obvious file-extension paths so middleware only runs on route-like requests.
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'
  ]
};
