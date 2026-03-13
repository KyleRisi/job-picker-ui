function normalizedPage(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 1;
}

export function pageHref(
  basePath: string,
  page: number,
  preservedSearchParams?: URLSearchParams,
  hash?: string
): string {
  const params = new URLSearchParams(preservedSearchParams?.toString() || '');
  const nextPage = normalizedPage(page);

  if (nextPage <= 1) {
    params.delete('page');
  } else {
    params.set('page', String(nextPage));
  }

  const query = params.toString();
  return `${basePath}${query ? `?${query}` : ''}${hash || ''}`;
}

export function buildMobileCompactPagination(currentPage: number, totalPages: number): { pages: number[] } {
  const page = normalizedPage(currentPage);
  const total = Math.max(1, normalizedPage(totalPages));

  if (total <= 5) {
    return { pages: Array.from({ length: total }, (_, index) => index + 1) };
  }

  const set = new Set<number>([1, total, page - 1, page, page + 1]);
  const pages = Array.from(set)
    .filter((item) => item >= 1 && item <= total)
    .sort((a, b) => a - b);

  return { pages };
}
