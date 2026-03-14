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

  if (total <= 3) {
    return { pages: Array.from({ length: total }, (_, index) => index + 1) };
  }

  if (page <= 1) {
    return { pages: [1, 2, 3] };
  }

  if (page >= total) {
    return { pages: [total - 2, total - 1, total] };
  }

  return { pages: [page - 1, page, page + 1] };
}
