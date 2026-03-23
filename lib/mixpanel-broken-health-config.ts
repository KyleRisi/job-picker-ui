export type IntentionalNotFoundMatcher =
  | { type: 'exact'; value: string }
  | { type: 'prefix'; value: string }
  | { type: 'regex'; value: RegExp };

// Single source of truth for retired/intentional not-found routes.
export const INTENTIONAL_NOT_FOUND_MATCHERS: IntentionalNotFoundMatcher[] = [
  { type: 'exact', value: '/cases' },
  { type: 'exact', value: '/series' },
  { type: 'exact', value: '/themes' },
  { type: 'exact', value: '/people' },
  { type: 'exact', value: '/events' },
  { type: 'exact', value: '/blog/tag' },
  { type: 'exact', value: '/blog/category' },
  { type: 'exact', value: '/blog/topic' },
  { type: 'exact', value: '/blog/series' },
  { type: 'prefix', value: '/cases/' },
  { type: 'prefix', value: '/series/' },
  { type: 'prefix', value: '/themes/' },
  { type: 'prefix', value: '/people/' },
  { type: 'prefix', value: '/events/' },
  { type: 'prefix', value: '/blog/tag/' },
  { type: 'prefix', value: '/blog/category/' },
  { type: 'prefix', value: '/blog/topic/' },
  { type: 'prefix', value: '/blog/series/' }
];

export function isIntentionalNotFoundPath(pathname: string | null | undefined): boolean {
  const path = `${pathname || ''}`.trim() || '/';

  return INTENTIONAL_NOT_FOUND_MATCHERS.some((matcher) => {
    if (matcher.type === 'exact') return path === matcher.value;
    if (matcher.type === 'prefix') return path.startsWith(matcher.value);
    return matcher.value.test(path);
  });
}
