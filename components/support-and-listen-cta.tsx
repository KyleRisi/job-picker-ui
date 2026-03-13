import Link from 'next/link';
import { PATREON_URL } from '@/lib/patreon-links';

export function SupportAndListenCta({
  pageType,
  pageSlug,
  pageUrl,
  contentTitle,
  placement,
  variant = 'hero',
  className = ''
}: {
  pageType: string;
  pageSlug?: string;
  pageUrl?: string;
  contentTitle?: string;
  placement?: string;
  variant?: 'hero' | 'compact';
  className?: string;
}) {
  const wrapperClass =
    variant === 'compact'
      ? 'rounded-2xl border border-carnival-ink/15 bg-white p-5'
      : 'rounded-3xl border border-carnival-gold/25 bg-carnival-ink px-6 py-8 text-white';

  return (
    <section
      className={`${wrapperClass} ${className}`.trim()}
      data-blog-cta="1"
      data-page-type={pageType}
      data-page-slug={pageSlug || ''}
      data-page-url={pageUrl || ''}
      data-content-title={contentTitle || ''}
      data-placement={placement || ''}
      aria-label="Support and listen actions"
    >
      <h2 className={`font-black ${variant === 'compact' ? 'text-xl text-carnival-ink' : 'text-3xl text-white'}`}>Support And Listen</h2>
      <p className={variant === 'compact' ? 'mt-2 text-carnival-ink/75' : 'mt-2 text-white/80'}>
        Catch more episodes, support the show, and stay connected with The Compendium.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <a
          href="https://open.spotify.com/show/5fA8xqUEfXvD8WQmMsmFJk"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-full bg-[#1DB954] px-5 py-2.5 text-sm font-black text-white no-underline transition hover:brightness-110"
        >
          Listen On Spotify
        </a>
        <a
          href="https://podcasts.apple.com/us/podcast/the-compendium-podcast/id1531291277"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-full bg-[#D56DFB] px-5 py-2.5 text-sm font-black text-white no-underline transition hover:brightness-110"
        >
          Listen On Apple
        </a>
        <Link
          href={PATREON_URL}
          className="inline-flex items-center justify-center rounded-full bg-carnival-red px-5 py-2.5 text-sm font-black text-white no-underline transition hover:brightness-110"
        >
          Join Patreon
        </Link>
      </div>
    </section>
  );
}
