import Image from 'next/image';
import Link from 'next/link';

type HomepageEpisodeCardProps = {
  href: string;
  title: string;
  artworkSrc: string;
  artworkAlt: string;
  eyebrow?: string;
  blurb: string;
  mobileSummary?: string;
  mobileMeta?: string;
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
  eyebrow = '',
  blurb,
  mobileSummary = '',
  primaryLabel = 'Listen now',
  primaryLinkProps
}: HomepageEpisodeCardProps) {
  const summary = `${mobileSummary || blurb || ''}`.replace(/\s+/g, ' ').trim();
  const excerpt = summary || 'No description available for this episode yet.';

  return (
    <article className="h-full overflow-hidden rounded-2xl border border-carnival-ink/10 bg-white">
      <div className="flex h-full flex-col p-4">
        <div className="mb-2 flex items-start gap-3">
          <div className="relative h-24 w-24 flex-none overflow-hidden rounded-lg">
            <Image
              src={artworkSrc}
              alt={artworkAlt}
              fill
              sizes="96px"
              className="object-cover"
              loading="lazy"
            />
          </div>
          <div className="min-w-0 flex-1 space-y-1 pt-0.5">
            <h3 className="line-clamp-3 text-[0.98rem] font-black leading-tight text-carnival-ink sm:text-[1.06rem]">
              <Link href={href} className="text-carnival-ink no-underline transition hover:text-carnival-ink/70">
                {title}
              </Link>
            </h3>
            {eyebrow ? (
              <span className="inline-block max-w-full truncate whitespace-nowrap rounded-full bg-carnival-red px-2 py-0.5 text-[11px] font-semibold text-white">
                {eyebrow}
              </span>
            ) : null}
          </div>
        </div>
        <p className="mt-2 min-h-[6rem] line-clamp-4 text-[0.8rem] leading-5 text-carnival-ink/80 sm:text-[0.85rem] sm:leading-6">
          <Link href={href} className="text-inherit no-underline transition hover:text-carnival-ink/65">
            {excerpt}
          </Link>
        </p>

        <div className="mt-auto pt-4">
          <Link
            href={href}
            className="btn-primary h-10 w-full whitespace-nowrap"
            {...primaryLinkProps}
          >
            {primaryLabel}
          </Link>
        </div>
      </div>
    </article>
  );
}
