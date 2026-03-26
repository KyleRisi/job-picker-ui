import { getPublicSiteUrl } from '@/lib/site-url';

export type HomepageV2Environment = 'preview' | 'production';

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);

function normalizeHostValue(value: string | null | undefined): string {
  return `${value || ''}`.trim().toLowerCase().split(':')[0];
}

function normalizeSiteSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');
}

function escapedRegexFragment(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isTruthyEnvFlag(value: string | undefined): boolean {
  return `${value || ''}`.trim().toLowerCase() === 'true';
}

export function normalizeHost(input: string | null | undefined): string {
  return normalizeHostValue(input);
}

export function getHomepageV2CanonicalHost(): string {
  const explicitHost = normalizeHostValue(process.env.HOMEPAGE_V2_CANONICAL_HOST || '');
  if (explicitHost) return explicitHost;
  try {
    const resolved = normalizeHostValue(new URL(getPublicSiteUrl()).host);
    if (!resolved || isHomepageV2LocalHost(resolved)) return 'www.thecompendiumpodcast.com';
    return resolved;
  } catch {
    return 'www.thecompendiumpodcast.com';
  }
}

export function getHomepageV2NetlifySiteSlug(): string {
  const configured = normalizeSiteSlug(process.env.HOMEPAGE_V2_NETLIFY_SITE_SLUG || '');
  return configured || 'compendium-circus-hr';
}

export function getHomepageV2AllowedNetlifyPreviewBranches(): string[] {
  return `${process.env.HOMEPAGE_V2_NETLIFY_PREVIEW_BRANCHES || ''}`
    .split(',')
    .map((value) => normalizeSiteSlug(value))
    .filter(Boolean);
}

export function getHomepageV2ExplicitAllowedHosts(): string[] {
  return `${process.env.HOMEPAGE_V2_PREVIEW_ALLOWED_HOSTS || ''}`
    .split(',')
    .map((host) => normalizeHostValue(host))
    .filter(Boolean);
}

export function isHomepageV2LocalHost(host: string): boolean {
  return LOCALHOST_HOSTS.has(normalizeHostValue(host));
}

export function isHomepageV2DeployPreviewHost(host: string): boolean {
  const normalizedHost = normalizeHostValue(host);
  const siteSlug = getHomepageV2NetlifySiteSlug();
  if (!normalizedHost || !siteSlug) return false;
  const pattern = new RegExp(`^deploy-preview-\\d+--${escapedRegexFragment(siteSlug)}\\.netlify\\.app$`);
  return pattern.test(normalizedHost);
}

export function isHomepageV2BranchDeployHost(host: string): boolean {
  const normalizedHost = normalizeHostValue(host);
  const siteSlug = getHomepageV2NetlifySiteSlug();
  const allowedBranches = new Set(getHomepageV2AllowedNetlifyPreviewBranches());
  if (!normalizedHost || !siteSlug || allowedBranches.size === 0) return false;

  const match = normalizedHost.match(new RegExp(`^([a-z0-9-]+)--${escapedRegexFragment(siteSlug)}\\.netlify\\.app$`));
  if (!match?.[1]) return false;
  const branchSlug = normalizeSiteSlug(match[1]);
  return allowedBranches.has(branchSlug);
}

export function isHomepageV2NetlifyPreviewHost(host: string): boolean {
  return isHomepageV2DeployPreviewHost(host) || isHomepageV2BranchDeployHost(host);
}

export function isHomepageV2PreviewHostAllowed(host: string): boolean {
  const normalizedHost = normalizeHostValue(host);
  if (!normalizedHost) return false;
  if (isHomepageV2LocalHost(normalizedHost)) return true;
  if (isHomepageV2NetlifyPreviewHost(normalizedHost)) return true;
  const explicit = new Set(getHomepageV2ExplicitAllowedHosts());
  return explicit.has(normalizedHost);
}

export function isHomepageV2CanonicalHost(host: string): boolean {
  return normalizeHostValue(host) === getHomepageV2CanonicalHost();
}

export function resolveHomepageV2EnvironmentFromHost(host: string): HomepageV2Environment {
  if (isHomepageV2CanonicalHost(host)) return 'production';
  if (isHomepageV2PreviewHostAllowed(host)) return 'preview';
  return 'production';
}

export function inferHomepageV2EnvironmentFromWindowLocation(): HomepageV2Environment {
  if (typeof window === 'undefined') return 'production';
  return resolveHomepageV2EnvironmentFromHost(window.location.host);
}

export function preferredProtocolForHost(host: string): 'http' | 'https' {
  const normalizedHost = normalizeHostValue(host);
  if (isHomepageV2LocalHost(normalizedHost)) return 'http';
  return 'https';
}

export function isHomepageV2LiveToggleEnabled(): boolean {
  return isTruthyEnvFlag(process.env.HOMEPAGE_V2_LIVE);
}

export function isHomepageV2LaunchGatePassed(): boolean {
  return isTruthyEnvFlag(process.env.HOMEPAGE_V2_GATE_PASSED);
}

export function shouldServeHomepageV2AtRoot(): boolean {
  return isHomepageV2LiveToggleEnabled() && isHomepageV2LaunchGatePassed();
}
