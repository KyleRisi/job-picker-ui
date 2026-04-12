import Image from 'next/image';
import Link from 'next/link';

type HomepageEpisodeCardProps = {
  href: string;
  title: string;
  artworkSrc: string;
  artworkAlt: string;
  eyebrow: string;
  blurb: string;
  mobileSummary?: string;
  mobileMeta?: string;
  excerptClampClass?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryLinkProps?: Record<string, string>;
  secondaryLinkProps?: Record<string, string>;
};

export function HomepageEpisodeCard({
  href,
  title,
  artworkSrc,
  artworkAlt,
  eyebrow,
  blurb,
  mobileSummary = '',
  mobileMeta = '',
  excerptClampClass = 'line-clamp-3 md:line-clamp-5',
  primaryLabel = 'Listen now',
  secondaryLabel = 'Episode page',
  primaryLinkProps,
  secondaryLinkProps
}: HomepageEpisodeCardProps) {
  return (
    <article className="card flex h-full flex-col overflow-hidden !border-0 !p-0">
      <div className="p-3">
        <div className="relative aspect-square w-full overflow-hidden rounded-lg">
          <Image
            src={artworkSrc}
            alt={artworkAlt}
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            className="object-contain"
            loading="lazy"
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4 md:p-5">
        <p className="text-xs font-black uppercase tracking-wider text-carnival-red">{eyebrow}</p>
        <h3 className="mt-1.5 line-clamp-3 text-lg font-black leading-tight text-carnival-ink md:mt-2 md:text-xl md:line-clamp-none">{title}</h3>
        {mobileSummary ? (
          <p className="mt-1 line-clamp-3 text-xs font-medium text-carnival-ink/70 md:hidden">{mobileSummary}</p>
        ) : null}
        {mobileMeta ? (
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-carnival-ink/55 md:hidden">{mobileMeta}</p>
        ) : null}
        <p className={`mt-2 hidden text-sm leading-relaxed text-carnival-ink/80 md:mt-3 md:block ${excerptClampClass}`}>{blurb}</p>

        <div className="mt-auto grid grid-cols-2 items-center gap-2 pt-4 md:pt-5">
          <Link
            href={href}
            className="btn-primary h-10 w-full whitespace-nowrap md:h-11"
            {...primaryLinkProps}
          >
            {primaryLabel}
          </Link>
          <Link
            href={href}
            className="inline-flex h-10 w-full items-center justify-center px-1 py-1 text-sm font-semibold text-carnival-ink/80 underline-offset-4 transition hover:text-carnival-red hover:underline md:h-11 md:rounded-md md:border md:border-carnival-ink/20 md:bg-white md:px-4 md:py-2 md:text-base md:text-carnival-ink md:no-underline md:hover:border-carnival-red/40"
            {...secondaryLinkProps}
          >
            {secondaryLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}
