import Link from 'next/link';
import { buildMobileCompactPagination } from '@/lib/pagination';

export function CompactPagination({
  page,
  totalPages,
  hrefForPage,
  ariaLabel,
  className
}: {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
  ariaLabel: string;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const compactPages = buildMobileCompactPagination(page, totalPages).pages;
  const previousPageHref = page > 1 ? hrefForPage(page - 1) : null;
  const nextPageHref = page < totalPages ? hrefForPage(page + 1) : null;

  return (
    <nav className={className || ''} aria-label={ariaLabel}>
      <div className="mx-auto flex w-fit max-w-full items-center justify-center gap-2 overflow-x-auto whitespace-nowrap px-1">
        {previousPageHref ? (
          <Link
            href={previousPageHref}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-carnival-ink text-white transition hover:brightness-110"
            rel="prev"
            aria-label="Previous page"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M12.5 4.5L7 10l5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ) : null}

        {compactPages.map((item) => (
          item === page ? (
            <span
              key={`compact-page-${item}`}
              className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-md bg-carnival-red px-3 text-sm font-black text-white"
              aria-current="page"
            >
              {item}
            </span>
          ) : (
            <Link
              key={`compact-page-${item}`}
              href={hrefForPage(item)}
              className="inline-flex h-10 min-w-10 shrink-0 items-center justify-center rounded-md bg-carnival-ink px-3 text-sm font-semibold text-white transition hover:brightness-110"
            >
              {item}
            </Link>
          )
        ))}

        {nextPageHref ? (
          <Link
            href={nextPageHref}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-carnival-ink text-white transition hover:brightness-110"
            rel="next"
            aria-label="Next page"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M7.5 4.5L13 10l-5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

