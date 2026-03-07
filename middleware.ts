import { NextRequest, NextResponse } from 'next/server';
import { buildRedirectLocation, normalizePath, shouldSkipRedirectLookup } from '@/lib/redirects';

type ResolveItem = {
  id: string;
  source_path: string;
  target_url: string;
  status_code: 301 | 302 | 307 | 308;
  match_type: 'exact' | 'prefix';
  priority: number;
};

type CacheEntry = {
  expiresAt: number;
  item: ResolveItem | null;
};

const LOOKUP_TIMEOUT_MS = 1200;
const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();
const NETLIFY_DEPLOY_PREVIEW_HOST_RE = /^deploy-preview-\d+--.+\.netlify\.app$/;
const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy-report-only':
    "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'"
};

function shouldNoindexHost(req: NextRequest): boolean {
  const host = (req.headers.get('host') || '').toLowerCase().split(':')[0];
  return NETLIFY_DEPLOY_PREVIEW_HOST_RE.test(host);
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

async function resolveRedirect(req: NextRequest, normalizedPath: string): Promise<ResolveItem | null> {
  const cached = readFromCache(normalizedPath);
  if (cached !== undefined) return cached;

  const secret = process.env.REDIRECT_RESOLVE_SECRET || '';
  if (!secret) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const url = new URL('/api/internal/redirects/resolve', req.url);
    url.searchParams.set('path', normalizedPath);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-redirect-resolve-secret': secret
      },
      cache: 'no-store',
      signal: controller.signal
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as { item?: ResolveItem | null };
    const item = payload.item || null;
    writeToCache(normalizedPath, item);
    return item;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function middleware(req: NextRequest) {
  const method = req.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return withBaselineHeaders(req, NextResponse.next());

  const normalizedPath = normalizePath(req.nextUrl.pathname);
  if (shouldSkipRedirectLookup(normalizedPath)) return withBaselineHeaders(req, NextResponse.next());

  const match = await resolveRedirect(req, normalizedPath);
  if (!match) return withBaselineHeaders(req, NextResponse.next());

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
    return withBaselineHeaders(req, NextResponse.next());
  }

  return withBaselineHeaders(req, NextResponse.redirect(destinationUrl, match.status_code));
}

export const config = {
  matcher: '/:path*'
};
