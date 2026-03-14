import Link from 'next/link';
import Image from 'next/image';
import { draftMode } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { BlogContentRenderer } from '@/components/blog/blog-content-renderer';
import { BlogAnalyticsTracker } from '@/components/blog/blog-analytics-tracker';
import { BlogPostCard } from '@/components/blog/blog-post-card';
import { CompactEpisodeRow } from '@/components/episodes-browser';
import { JoinPatreonCta } from '@/components/join-patreon-cta';
import { collectReferencedImageIds, hasPrimaryListenEpisodeBlock, normalizeBlogDocument, richTextToPlainText } from '@/lib/blog/content';
import type { BlogContentBlock } from '@/lib/blog/schema';
import { breadcrumbsToJsonLd } from '@/lib/breadcrumbs';
import { getBlogPostBySlug, getMediaAssetMapByIds, resolveBlogSlugRedirect } from '@/lib/blog/data';
import { getStoragePublicUrl } from '@/lib/blog/media-url';
import { buildBlogPostBreadcrumbs } from '@/lib/episodes';
import type { PodcastEpisode } from '@/lib/podcast-shared';
import { getPublicSiteUrl } from '@/lib/site-url';
import { PATREON_INTERNAL_PATH } from '@/lib/patreon-links';

export const revalidate = 300;

type Params = { slug: string };

function IconX() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M18.9 2H22l-6.77 7.74L23.2 22h-6.24l-4.89-6.4L6.5 22H3.4l7.24-8.28L2.8 2h6.4l4.42 5.86L18.9 2Z" />
    </svg>
  );
}

function IconFacebook() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.3-1.5 1.6-1.5h1.7V4.6c-.3 0-1.3-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.3v2.4H8v3.1h2.7v8h2.8z" />
    </svg>
  );
}

async function loadPost(slug: string, includeDraft: boolean) {
  const post = await getBlogPostBySlug(slug, { includeDraft });
  if (!post) return null;
  const assetMap = await getMediaAssetMapByIds(collectReferencedImageIds(post.content_json));
  return {
    post,
    assetMap
  };
}

function resolveBlogCanonicalValue(postSlug: string, canonicalUrl: string | null): string {
  const fallbackPath = `/blog/${postSlug}`;
  const raw = `${canonicalUrl || ''}`.trim();
  if (!raw) return fallbackPath;

  try {
    const siteUrl = getPublicSiteUrl();
    const parsed = new URL(raw, siteUrl);
    if (!/^https?:$/i.test(parsed.protocol)) return fallbackPath;

    const siteOrigin = new URL(siteUrl).origin;
    if (parsed.origin === siteOrigin) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return parsed.toString();
  } catch {
    return fallbackPath;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const includeDraft = draftMode().isEnabled;
  const loaded = await loadPost(params.slug, includeDraft);
  if (!loaded) {
    return {
      title: 'Post not found',
      robots: { index: false, follow: false }
    };
  }
  const { post } = loaded;
  const description = post.seo_description || post.excerpt || post.excerpt_auto || 'Read the latest article from The Compendium.';
  const canonicalValue = resolveBlogCanonicalValue(post.slug, post.canonical_url);
  const imageUrl = post.og_image
    ? getStoragePublicUrl(post.og_image.storage_path)
    : post.featured_image
      ? getStoragePublicUrl(post.featured_image.storage_path)
      : '/The Compendium Main.jpg';
  return {
    title: post.seo_title || post.title,
    description,
    alternates: { canonical: canonicalValue },
    robots: {
      index: !post.noindex,
      follow: !post.nofollow
    },
    openGraph: {
      title: post.social_title || post.seo_title || post.title,
      description: post.social_description || description,
      url: canonicalValue,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: post.title
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title: post.social_title || post.title,
      description: post.social_description || description,
      images: [imageUrl]
    }
  };
}

export default async function BlogPostPage({ params }: { params: Params }) {
  const includeDraft = draftMode().isEnabled;
  const loaded = await loadPost(params.slug, includeDraft);
  if (!loaded) {
    if (!includeDraft) {
      const redirectPath = await resolveBlogSlugRedirect(params.slug);
      if (redirectPath) {
        redirect(redirectPath);
      }
    }
    notFound();
  }

  const { post, assetMap } = loaded;
  const linkedEpisodes = post.linked_episodes || [];
  const normalizedDocument = normalizeBlogDocument(post.content_json);
  const hasPrimaryListenBlock = hasPrimaryListenEpisodeBlock(normalizedDocument);
  const linkedEpisodeCards: PodcastEpisode[] = linkedEpisodes
    .map((item: { episode: any }) => item.episode)
    .filter(Boolean)
    .map((episode: any) => ({
      id: episode.id,
      slug: episode.slug,
      title: episode.title,
      seasonNumber: null,
      episodeNumber: episode.episode_number ?? null,
      publishedAt: episode.published_at || '',
      description: episode.description_plain || '',
      descriptionHtml: episode.description_html || '',
      audioUrl: episode.audio_url || '',
      artworkUrl: episode.artwork_url || null,
      duration: null,
      sourceUrl: null
    }));
  const primaryEpisode = linkedEpisodes[0]?.episode || null;
  const relatedEpisodeCards: PodcastEpisode[] = hasPrimaryListenBlock ? linkedEpisodeCards.slice(1) : linkedEpisodeCards;
  const siteUrl = getPublicSiteUrl();
  const canonicalValue = resolveBlogCanonicalValue(post.slug, post.canonical_url);
  const canonicalUrl = new URL(canonicalValue, siteUrl).toString();
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': post.schema_type || 'BlogPosting',
    headline: post.title,
    description: post.seo_description || post.excerpt || post.excerpt_auto || '',
    url: canonicalUrl,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    author: {
      '@type': 'Person',
      name: post.author?.name || 'Kyle',
      url: `${siteUrl}/blog/author/${post.author?.slug || 'kyle'}`
    },
    image: post.featured_image ? getStoragePublicUrl(post.featured_image.storage_path) : `${siteUrl}/The Compendium Main.jpg`,
    mainEntityOfPage: canonicalUrl,
    isPartOf: {
      '@type': 'WebSite',
      name: 'The Compendium Podcast',
      url: siteUrl
    },
    about: primaryEpisode
      ? {
          '@type': 'PodcastEpisode',
          name: primaryEpisode.title,
          url: `${siteUrl}/episodes/${primaryEpisode.slug}`
        }
      : undefined
  };
  const breadcrumbItems = buildBlogPostBreadcrumbs(post);
  const breadcrumbJsonLd = breadcrumbsToJsonLd(breadcrumbItems, siteUrl);

  const featuredImageUrl = post.featured_image ? getStoragePublicUrl(post.featured_image.storage_path) : null;
  const excerpt = post.excerpt || post.excerpt_auto;
  const shareUrl = encodeURIComponent(canonicalUrl);
  const shareOnXHref = `https://twitter.com/intent/tweet?url=${shareUrl}&text=${encodeURIComponent(post.title)}`;
  const shareOnFacebookHref = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
  const actionButtonClass =
    'inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/30 bg-white/10 text-white transition hover:border-carnival-gold/55 hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white';

  return (
    <section className="full-bleed relative -mt-8 -mb-8 overflow-hidden bg-carnival-ink pb-14 md:pb-20">
      <BlogAnalyticsTracker postId={post.id} episodeId={primaryEpisode?.id || null} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      {(() => {
        const faqItems = normalizedDocument
          .filter((block): block is Extract<BlogContentBlock, { type: 'faq' }> => block.type === 'faq')
          .flatMap((block) => block.items)
          .filter((item) => item.question.trim());
        if (!faqItems.length) return null;
        const faqJsonLd = {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqItems.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: richTextToPlainText(item.answer)
            }
          }))
        };
        return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />;
      })()}

      <section className="relative overflow-hidden bg-carnival-ink">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {featuredImageUrl ? (
            <Image
              src={featuredImageUrl}
              alt={post.featured_image?.alt_text_default || post.title}
              fill
              quality={68}
              sizes="100vw"
              className="object-cover object-center md:object-[50%_25%]"
            />
          ) : null}
          <div
            className={`absolute inset-0 ${
              featuredImageUrl
                ? 'bg-gradient-to-b from-carnival-ink/30 via-carnival-ink/60 to-carnival-ink'
                : 'bg-gradient-to-b from-[#2d1c49] via-carnival-ink/90 to-carnival-ink'
            }`}
          />
          <div className="absolute inset-x-0 bottom-0 h-[34vh] bg-gradient-to-b from-transparent via-carnival-ink/90 to-carnival-ink md:h-[42vh]" />
          <div className="absolute -left-24 top-[30%] h-72 w-72 rounded-full bg-carnival-red/20 blur-[110px]" />
          <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-carnival-gold/15 blur-[110px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4">
          <header className="flex min-h-[52vh] items-end pb-9 pt-20 sm:min-h-[58vh] sm:pb-11 md:min-h-[68vh] md:pt-24">
            <div className="w-full">
              <div className="max-w-4xl">
                <p className="text-xs font-black uppercase tracking-[0.08em] text-carnival-gold">The Compendium Podcast</p>
                <h1 className="mt-2 text-4xl font-black leading-tight text-white sm:text-5xl md:text-6xl">{post.title}</h1>
                {excerpt ? <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/90 sm:text-lg">{excerpt}</p> : null}
              </div>

              <div className="mt-6 w-full">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/85">
                  {post.author ? (
                    <Link href={`/blog/author/${post.author.slug}`} className="transition hover:text-white">
                      {post.author.name}
                    </Link>
                  ) : null}
                  {post.published_at ? <span>{new Date(post.published_at).toLocaleDateString('en-GB')}</span> : null}
                  {post.reading_time_minutes ? <span>{post.reading_time_minutes} min read</span> : null}
                </div>

                <div className="mt-3 w-full border-t border-white/25" />

                <div className="mt-3 flex w-full justify-end gap-2">
                  <a
                    href={shareOnXHref}
                    target="_blank"
                    rel="noreferrer"
                    className={actionButtonClass}
                    aria-label="Share on X"
                    title="Share on X"
                    data-blog-cta="1"
                  >
                    <IconX />
                  </a>
                  <a
                    href={shareOnFacebookHref}
                    target="_blank"
                    rel="noreferrer"
                    className={actionButtonClass}
                    aria-label="Share on Facebook"
                    title="Share on Facebook"
                    data-blog-cta="1"
                  >
                    <IconFacebook />
                  </a>
                  <Link
                    href={PATREON_INTERNAL_PATH}
                    className={actionButtonClass}
                    aria-label="Join Patreon"
                    title="Join Patreon"
                    data-blog-cta="1"
                  >
                    <Image src="/patreon-icon.svg" alt="" width={16} height={16} className="h-4 w-4 brightness-0 invert" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </div>
          </header>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl -mt-4 space-y-8 px-4 text-white sm:-mt-6">
        <BlogContentRenderer
          document={post.content_json}
          assetMap={assetMap}
          linkedEpisodes={post.linked_episodes}
          relatedPosts={post.related_posts.map((item: any) => ({ id: item.id, slug: item.slug, title: item.title }))}
          theme="dark"
        />

        {relatedEpisodeCards.length ? (
          <section className="space-y-4">
            <h2 className="text-3xl font-black text-white">Related episodes</h2>
            <div className="space-y-4">
              {relatedEpisodeCards.map((episode) => (
                <CompactEpisodeRow key={episode.id} episode={episode} />
              ))}
            </div>
          </section>
        ) : null}

        {post.related_posts.length ? (
          <section className="space-y-4">
            <h2 className="text-3xl font-black text-white">Related posts</h2>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {post.related_posts.map((item: any) => (
                <BlogPostCard key={item.id} post={item} onDark />
              ))}
            </div>
          </section>
        ) : null}
      </section>

      <div className="mt-8">
        <JoinPatreonCta />
      </div>
    </section>
  );
}
