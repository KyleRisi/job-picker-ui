export const SOURCE_PAGE_TYPES = [
  'home',
  'episode_list',
  'episode_page',
  'blog_post',
  'discovery_hub',
  'patreon_page',
  'connect',
  'press_kit',
  'jobs_page',
  'job_page',
  'job_apply_page',
  'other_page'
] as const;

export const PLAYER_LOCATIONS = ['episode_card', 'inline_player', 'episode_player', 'global_player'] as const;

export const DESTINATIONS = ['patreon', 'spotify', 'apple_podcasts'] as const;

export const CTA_LOCATIONS = [
  'header',
  'hero',
  'episode_card',
  'episode_page',
  'blog_post',
  'patreon_page',
  'footer',
  'global_player',
  'other_cta'
] as const;

export type SourcePageType = (typeof SOURCE_PAGE_TYPES)[number];
export type PlayerLocation = (typeof PLAYER_LOCATIONS)[number];
export type Destination = (typeof DESTINATIONS)[number];
export type CtaLocation = (typeof CTA_LOCATIONS)[number];

export function normalizePath(pathname: string | null | undefined): string {
  if (!pathname) return '/';
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

export function resolveSourcePageType(pathname: string | null | undefined): SourcePageType {
  const path = normalizePath(pathname);
  if (path === '/') return 'home';
  if (path === '/episodes') return 'episode_list';
  if (path.startsWith('/episodes/')) return 'episode_page';
  if (path.startsWith('/blog/')) return 'blog_post';
  if (
    path.startsWith('/topics/') ||
    path.startsWith('/themes/') ||
    path.startsWith('/people/') ||
    path.startsWith('/cases/') ||
    path.startsWith('/events/') ||
    path.startsWith('/collections/') ||
    path.startsWith('/series/')
  ) {
    return 'discovery_hub';
  }
  if (path === '/patreon') return 'patreon_page';
  if (path === '/connect') return 'connect';
  if (path === '/connect/press-kit') return 'press_kit';
  if (path === '/jobs') return 'jobs_page';
  if (path.startsWith('/jobs/')) return 'job_page';
  if (path.startsWith('/apply/')) return 'job_apply_page';
  return 'other_page';
}

export function currentPathWithSearch(): string {
  if (typeof window === 'undefined') return '/';
  return `${window.location.pathname}${window.location.search || ''}`;
}

export function resolveDestination(href: string): Destination | null {
  const value = `${href || ''}`.toLowerCase();
  if (!value) return null;
  if (value.includes('patreon.com')) return 'patreon';
  if (value.includes('spotify.com')) return 'spotify';
  if (value.includes('apple.com') && value.includes('podcast')) return 'apple_podcasts';
  return null;
}

export function shouldTrackOncePerSession(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.sessionStorage.getItem(key) === '1') return false;
    window.sessionStorage.setItem(key, '1');
    return true;
  } catch {
    return true;
  }
}

export function routeVisitStorageKey(prefix: string): string {
  if (typeof window === 'undefined') return prefix;
  const state = window.history.state as { key?: string; idx?: number } | null;
  const visitKey =
    (typeof state?.key === 'string' && state.key) ||
    (typeof state?.idx === 'number' ? String(state.idx) : '') ||
    `${window.location.pathname}${window.location.search}`;
  return `${prefix}:${visitKey}`;
}

export function isPublicAnalyticsPath(pathname: string | null | undefined): boolean {
  const path = normalizePath(pathname);
  if (!path) return false;
  if (path.startsWith('/admin')) return false;
  if (path.startsWith('/workspace')) return false;
  if (path.startsWith('/api')) return false;
  if (path.startsWith('/_next')) return false;
  if (path.startsWith('/preview/') && path !== '/preview/homepage-v2') return false;
  return true;
}
