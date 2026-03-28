import type { Metadata } from 'next';
import Image from 'next/image';
import { BlogListingPage } from '@/components/blog/blog-listing-page';
import { listFeaturedBlogPosts, listPublishedBlogPostsFeed } from '@/lib/blog/data';
import { buildCanonicalAndSocialMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'SEO-focused articles from The Compendium podcast, linked to episodes, transcripts, and listener resources.',
  ...buildCanonicalAndSocialMetadata({
    title: 'Blog | The Compendium Podcast',
    description: 'SEO-focused articles from The Compendium podcast, linked to episodes, transcripts, and listener resources.',
    twitterTitle: 'Blog | The Compendium Podcast',
    twitterDescription: 'SEO-focused articles from The Compendium podcast, linked to episodes, transcripts, and listener resources.',
    canonicalCandidate: '/blog',
    fallbackPath: '/blog',
    openGraphType: 'website',
    imageUrl: '/The Compendium Main.jpg',
    imageAlt: 'The Compendium Podcast blog'
  })
};

export const revalidate = 300;

export default async function BlogIndexPage() {
  const [featuredPosts, feed] = await Promise.all([
    listFeaturedBlogPosts({ limit: 6 }),
    listPublishedBlogPostsFeed({ offset: 0, limit: 24 })
  ]);

  return (
    <section className="full-bleed relative -mt-8 overflow-hidden bg-carnival-ink py-14 md:py-20">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <Image
          src="/cover-banner-hero.jpg"
          alt=""
          fill
          priority
          quality={72}
          className="object-cover object-top opacity-30"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-carnival-ink/70 via-carnival-ink/85 to-carnival-ink" />
        <div className="absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-carnival-red/25 blur-[120px]" />
        <div className="absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-carnival-gold/20 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4">
        <header className="mb-10 text-center md:mb-14">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-carnival-gold">The Compendium Podcast</p>
          <h1 className="mt-3 text-4xl font-black leading-tight text-white sm:text-5xl">All The Latest Things</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
            News, deep-dives, oddities, and episode companions from the Compendium universe.
          </p>
        </header>

        <BlogListingPage
          title="All The Latest Things"
          description="Explore search-friendly guides, episode companions, transcripts, and topic clusters built to help new listeners discover the show."
          posts={feed.items}
          featuredPosts={featuredPosts}
          pagination={{ page: 1, totalPages: 1, total: feed.total, pageSize: 24 }}
          featuredFirst
          showHeader={false}
          onDark
        />
      </div>
    </section>
  );
}
