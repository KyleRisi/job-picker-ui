import type { Metadata } from 'next';
import Link from 'next/link';
import { buildCanonicalAndSocialMetadata } from '@/lib/seo-metadata';

const ABOUT_TITLE = 'About the Show';
const ABOUT_DESCRIPTION =
  'Learn about The Compendium Podcast, the weekly show exploring true crime, history, and incredible people.';

export const metadata: Metadata = {
  title: ABOUT_TITLE,
  description: ABOUT_DESCRIPTION,
  ...buildCanonicalAndSocialMetadata({
    title: 'About the Show | The Compendium Podcast',
    description: ABOUT_DESCRIPTION,
    twitterTitle: 'About the Show | The Compendium Podcast',
    twitterDescription: ABOUT_DESCRIPTION,
    canonicalCandidate: '/about',
    fallbackPath: '/about',
    openGraphType: 'website',
    imageUrl: '/The Compendium Main.jpg',
    imageAlt: 'About The Compendium Podcast'
  })
};

export default function AboutPage() {
  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <p className="inline-block rounded-full bg-carnival-red px-3 py-1 text-xs font-black uppercase tracking-wider text-white">
          About The Compendium
        </p>
        <h1 className="text-4xl font-black text-carnival-ink">True Crime, History &amp; Incredible People</h1>
        <p className="max-w-3xl text-base leading-relaxed text-carnival-ink/80">
          The Compendium is a weekly storytelling podcast hosted by Kyle Risi and Adam Cox. Every week, the show explores
          one fascinating true story from the worlds of true crime, forgotten history, and extraordinary lives.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="card">
          <h2 className="text-xl font-black text-carnival-ink">One Story Per Episode</h2>
          <p className="mt-2 text-sm leading-relaxed text-carnival-ink/80">
            Every episode is designed as one complete listen, so you can jump in anywhere without a huge backlog.
          </p>
        </article>
        <article className="card">
          <h2 className="text-xl font-black text-carnival-ink">Research + Personality</h2>
          <p className="mt-2 text-sm leading-relaxed text-carnival-ink/80">
            Expect sharp storytelling, strong research, and the occasional bit of administrative circus nonsense.
          </p>
        </article>
        <article className="card">
          <h2 className="text-xl font-black text-carnival-ink">Start Listening Fast</h2>
          <p className="mt-2 text-sm leading-relaxed text-carnival-ink/80">
            New listener? Start with the curated episodes on the homepage and pick your lane.
          </p>
        </article>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/" className="btn-primary">Back to homepage</Link>
        <Link href="/episodes" className="inline-flex items-center justify-center rounded-md border border-carnival-ink/20 bg-white px-4 py-2 font-semibold text-carnival-ink transition hover:border-carnival-red/45 hover:text-carnival-red">
          Browse episodes
        </Link>
      </div>
    </section>
  );
}
