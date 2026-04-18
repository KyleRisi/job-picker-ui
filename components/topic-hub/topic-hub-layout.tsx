import Link from 'next/link';
import Image from 'next/image';
import { BlogPostCard } from '@/components/blog/blog-post-card';
import { HomepageEpisodeCard } from '@/components/home/homepage-episode-card';
import { HomepageTopicCard } from '@/components/home/homepage-topic-card';
import { DiscoveryAnalyticsEventTracker } from '@/components/discovery-analytics-event-tracker';
import { type RelatedBlogPostSummary } from '@/lib/podcast-shared';
import type { TopicHubLayoutProps } from '@/lib/topic-hub/topic-hub-types';

function mapRelatedPost(post: RelatedBlogPostSummary) {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    published_at: post.publishedAt,
    reading_time_minutes: post.readingTimeMinutes,
    author: post.author,
    featured_image: post.featuredImage
      ? {
          storage_path: post.featuredImage.storagePath,
          alt_text_default: post.featuredImage.altText
        }
      : null
  };
}

function getSectionGridClass(cardCount: number) {
  if (cardCount === 1) return 'grid gap-5';
  if (cardCount === 2) return 'grid gap-5 md:grid-cols-3';
  if (cardCount === 3) return 'grid gap-5 md:grid-cols-2 xl:grid-cols-3';
  return 'grid gap-5 md:grid-cols-2 xl:grid-cols-4';
}

function formatFullPublishedDate(value: string | null | undefined): string | null {
  const raw = `${value || ''}`.trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(parsed);
}

export function TopicHubLayout({ hub, featuredEpisodes, groupedSections, config }: TopicHubLayoutProps) {
  const pagePath = hub.term.path || `/topics/${hub.term.slug}`;
  const pageType = 'topic_hub';
  const topicSlug = hub.term.slug;
  const heroMobileTitle = config.hero.mobileTitle || config.hero.title;
  const heroMobileDescriptor = config.hero.mobileDescriptor || config.hero.descriptor;
  const heroMobileIntro = config.hero.mobileIntro || config.hero.intro;
  const sectionBadgeClass = 'inline-block rounded-full bg-carnival-red px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white';
  const caseTypeChips = groupedSections
    .map((section) => ({
      label: section.chipLabel,
      href: `#${section.id}`
    }))
    .sort((a, b) => {
      const order = new Map(config.chips.chipOrder.map((chipId, index) => [`#${chipId}`, index + 1]));
      return (order.get(a.href) ?? 999) - (order.get(b.href) ?? 999);
    });

  const relatedArticlesConfig = config.relatedArticles;
  const relatedArticles =
    relatedArticlesConfig && Array.isArray(hub.relatedPosts) && hub.relatedPosts.length >= relatedArticlesConfig.minimumItems
      ? hub.relatedPosts.slice(0, relatedArticlesConfig.minimumItems)
      : [];

  const topicHubCardEventProps = (episodeSlug: string, sourceSection: string, destination: string) => ({
    'data-discovery-event': 'topic_hub_card_clicked',
    'data-page-path': pagePath,
    'data-page-type': pageType,
    'data-topic-slug': topicSlug,
    'data-episode-slug': episodeSlug,
    'data-destination': destination,
    'data-source-section': sourceSection
  });

  const archiveEventProps = (destination: string) => ({
    'data-discovery-event': 'topic_hub_archive_clicked',
    'data-page-path': pagePath,
    'data-page-type': pageType,
    'data-topic-slug': topicSlug,
    'data-destination': destination,
    'data-source-section': 'final_archive_cta'
  });

  const relatedTopicEventProps = (destination: string) => {
    const destinationTopicSlug = destination.startsWith('/topics/')
      ? destination.slice('/topics/'.length).split(/[?#]/)[0]
      : '';

    return {
      'data-discovery-event': 'related_topic_clicked',
      'data-page-path': pagePath,
      'data-page-type': pageType,
      'data-topic-slug': topicSlug,
      'data-destination-topic-slug': destinationTopicSlug,
      'data-destination': destination,
      'data-source-section': 'related_topics'
    };
  };

  return (
    <>
      <DiscoveryAnalyticsEventTracker />
      <section className="full-bleed relative -mt-8 overflow-hidden bg-carnival-ink pb-9 pt-10 text-white md:pb-14 md:pt-18">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-carnival-red/30 blur-[120px]" />
          <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-carnival-gold/20 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="md:grid md:grid-cols-[360px_1fr] md:items-center md:gap-10">
            {config.hero.card ? (
              <article className="relative isolate mx-auto mb-5 h-[230px] w-[230px] overflow-hidden rounded-xl bg-carnival-ink shadow-[0_14px_30px_rgba(0,0,0,0.5)] md:mb-0 md:mx-0 md:aspect-square md:h-auto md:w-full md:rounded-2xl md:shadow-[0_18px_40px_rgba(0,0,0,0.45)]">
                <Image
                  src={config.hero.card.backgroundImageUrl}
                  alt={`${config.hero.card.title} artwork`}
                  fill
                  priority
                  quality={72}
                  sizes="(max-width: 767px) 230px, 360px"
                  className="absolute inset-0 -z-20 object-cover"
                />
              </article>
            ) : null}
            <div className="max-w-[780px] text-center md:text-left">
            <p className={sectionBadgeClass}>{config.hero.eyebrow}</p>
            <h1 className="mt-5 max-w-3xl text-[30px] font-black leading-[1.06] tracking-tight text-white sm:text-[40px] md:text-[50px]">
              <span className="md:hidden">{heroMobileTitle}</span>
              <span className="hidden md:inline">{config.hero.title}</span>
            </h1>
            {(heroMobileDescriptor || config.hero.descriptor) ? (
              <p className="mt-3 text-sm font-semibold tracking-[0.03em] text-carnival-gold/90 md:text-base">
                <span className="md:hidden">{heroMobileDescriptor}</span>
                <span className="hidden md:inline">{config.hero.descriptor}</span>
              </p>
            ) : null}
            <p className="mt-4 max-w-[62ch] text-[15px] leading-[1.75] text-white/84 md:mt-6 md:text-[18px] md:leading-[1.95]">
              <span className="md:hidden">{heroMobileIntro}</span>
              <span className="hidden md:inline">{config.hero.intro}</span>
            </p>
            <div className="mt-6 grid w-full gap-2 sm:mt-9 sm:flex sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-3.5">
              <Link
                href={config.hero.primaryAction.href}
                className="inline-flex w-full items-center justify-center rounded-full bg-carnival-red px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-white shadow-[0_10px_30px_rgba(185,28,28,0.35)] transition hover:brightness-110 sm:w-auto sm:px-6 sm:py-3.5"
              >
                {config.hero.primaryAction.label}
              </Link>
              <Link
                href={config.hero.secondaryAction.href}
                className="inline-flex w-full items-center justify-center rounded-full border border-carnival-gold/60 bg-carnival-gold/14 px-5 py-3 text-sm font-black tracking-[0.08em] text-carnival-gold transition hover:border-carnival-gold hover:bg-carnival-gold/20 sm:w-auto"
              >
                {config.hero.secondaryAction.label}
              </Link>
            </div>
            {config.hero.tertiaryAction ? (
              <a
                href={config.hero.tertiaryAction.href}
                target={config.hero.tertiaryAction.external ? '_blank' : undefined}
                rel={config.hero.tertiaryAction.external ? 'noreferrer' : undefined}
                className="mt-1 ml-1 hidden items-center px-1 py-1 text-xs font-bold uppercase tracking-[0.12em] text-white/75 underline-offset-4 transition hover:text-white hover:underline md:inline-flex"
              >
                {config.hero.tertiaryAction.label}
              </a>
            ) : null}
            {config.hero.trustStripItems && config.hero.trustStripItems.length > 0 ? (
              <div className="mt-8 border-t border-white/14 pt-5 text-xs font-semibold tracking-[0.04em] text-white/62">
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {config.hero.trustStripItems.map((item, index) => (
                    <div key={item} className="inline-flex items-center gap-5">
                      <span>{item}</span>
                      {index < config.hero.trustStripItems!.length - 1 ? (
                        <span className="hidden text-white/35 sm:inline">•</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="full-bleed" style={{ backgroundColor: 'var(--brand-cream)' }}>
        <div className="mx-auto max-w-6xl space-y-10 px-4 pb-0 pt-0 md:space-y-14 md:pb-0 md:pt-0">
          <div className="space-y-0">
            <section
              id={config.startHere.sectionId}
              className="full-bleed scroll-mt-24 pt-10 pb-8 md:pt-12 md:pb-10"
              style={{ backgroundColor: '#e8c775' }}
            >
              <div className="mx-auto max-w-6xl space-y-6 px-4">
                <div className="max-w-3xl space-y-3">
                  <p className={sectionBadgeClass}>{config.startHere.eyebrow}</p>
                  <h2 className="text-3xl font-black tracking-tight text-carnival-ink md:text-4xl">{config.startHere.heading}</h2>
                  <p className="text-base leading-7 text-carnival-ink/72 md:text-lg">{config.startHere.intro}</p>
                </div>
                <div className="grid gap-5 md:grid-cols-3">
                  {featuredEpisodes.map((episode) => (
                    <HomepageEpisodeCard
                      key={episode.id}
                      href={`/episodes/${episode.slug}`}
                      title={episode.title}
                      artworkSrc={episode.artworkUrl || '/The Compendium Main.jpg'}
                      artworkAlt={`${episode.title} artwork`}
                      eyebrow={episode.primaryTopicName || 'Featured episode'}
                      publishedDate={formatFullPublishedDate(episode.publishedAt)}
                      duration={episode.duration || null}
                      authorName={episode.authorName || null}
                      blurb={episode.description}
                      mobileSummary={episode.description}
                      mobileMeta={[
                        episode.episodeNumber ? `Ep ${episode.episodeNumber}` : null,
                        episode.duration || null,
                        formatFullPublishedDate(episode.publishedAt)
                      ].filter(Boolean).join(' • ')}
                      primaryLinkProps={topicHubCardEventProps(episode.slug, 'start_here', `/episodes/${episode.slug}`)}
                      secondaryLinkProps={topicHubCardEventProps(episode.slug, 'start_here', `/episodes/${episode.slug}`)}
                    />
                  ))}
                </div>
              </div>
            </section>

            {caseTypeChips.length > 1 ? (
              <section className="full-bleed bg-carnival-ink px-4 py-16 text-white md:py-24">
                <div className="mx-auto max-w-6xl text-center">
                  <div className="mx-auto max-w-4xl space-y-4">
                    <p className={sectionBadgeClass}>{config.chips.eyebrow}</p>
                    <h2 className="text-3xl font-black tracking-tight md:text-4xl">{config.chips.heading}</h2>
                    <p className="mx-auto max-w-3xl text-base leading-8 text-white/78 md:text-lg">{config.chips.intro}</p>
                  </div>
                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                    {caseTypeChips.map((chip) => (
                      <a
                        key={chip.href}
                        href={chip.href}
                        className="inline-flex min-h-[44px] items-center rounded-full border border-carnival-gold/35 bg-carnival-ink/55 px-5 py-2.5 text-sm font-semibold text-white/95 transition hover:border-carnival-red/45 hover:bg-carnival-ink/75 md:text-base"
                      >
                        {chip.label}
                      </a>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}
          </div>

        {groupedSections.map((section, index) => {
          const visibleEpisodes = section.maxVisibleEpisodes
            ? section.episodes.slice(0, section.maxVisibleEpisodes)
            : section.episodes;

          if (section.styleVariant === 'full-bleed-gold') {
            return (
              <div key={section.id} className="full-bleed !mt-0 py-8 md:py-10" style={{ backgroundColor: 'var(--brand-cream)' }}>
                <section id={section.id} className="mx-auto max-w-6xl scroll-mt-24 space-y-6 px-4">
                  <div className="max-w-3xl space-y-3">
                    <p className={sectionBadgeClass}>{config.sectionEyebrow}</p>
                    <h2 className="text-3xl font-black tracking-tight text-carnival-ink md:text-4xl">{section.title}</h2>
                    <p className="text-base leading-7 text-carnival-ink/72 md:text-lg">{section.intro}</p>
                  </div>
                  <div className={getSectionGridClass(visibleEpisodes.length)}>
                    {visibleEpisodes.map((episode) => (
                      <HomepageEpisodeCard
                        key={`${section.id}-${episode.id}`}
                        href={`/episodes/${episode.slug}`}
                        title={episode.title}
                        artworkSrc={episode.artworkUrl || '/The Compendium Main.jpg'}
                        artworkAlt={`${episode.title} artwork`}
                        eyebrow={episode.primaryTopicName || 'Featured episode'}
                        publishedDate={formatFullPublishedDate(episode.publishedAt)}
                        duration={episode.duration || null}
                        authorName={episode.authorName || null}
                        blurb={episode.description}
                        mobileSummary={episode.description}
                        mobileMeta={[
                          episode.episodeNumber ? `Ep ${episode.episodeNumber}` : null,
                          episode.duration || null,
                          formatFullPublishedDate(episode.publishedAt)
                        ].filter(Boolean).join(' • ')}
                        primaryLinkProps={topicHubCardEventProps(episode.slug, section.id, `/episodes/${episode.slug}`)}
                        secondaryLinkProps={topicHubCardEventProps(episode.slug, section.id, `/episodes/${episode.slug}`)}
                      />
                    ))}
                  </div>
                </section>
              </div>
            );
          }

          if (section.styleVariant === 'mobile-full-bleed-panel') {
            return (
              <div key={section.id} className="full-bleed py-5 md:py-0">
                <section
                  id={section.id}
                  className="mx-auto max-w-6xl scroll-mt-24 space-y-6 px-4"
                >
                  <div className="max-w-3xl space-y-3">
                    <p className={sectionBadgeClass}>{config.sectionEyebrow}</p>
                    <h2 className="text-3xl font-black tracking-tight text-carnival-ink md:text-4xl">{section.title}</h2>
                    <p className="text-base leading-7 text-carnival-ink/72 md:text-lg">{section.intro}</p>
                  </div>
                  <div className={getSectionGridClass(visibleEpisodes.length)}>
                    {visibleEpisodes.map((episode) => (
                      <HomepageEpisodeCard
                        key={`${section.id}-${episode.id}`}
                        href={`/episodes/${episode.slug}`}
                        title={episode.title}
                        artworkSrc={episode.artworkUrl || '/The Compendium Main.jpg'}
                        artworkAlt={`${episode.title} artwork`}
                        eyebrow={episode.primaryTopicName || 'Featured episode'}
                        publishedDate={formatFullPublishedDate(episode.publishedAt)}
                        duration={episode.duration || null}
                        authorName={episode.authorName || null}
                        blurb={episode.description}
                        mobileSummary={episode.description}
                        mobileMeta={[
                          episode.episodeNumber ? `Ep ${episode.episodeNumber}` : null,
                          episode.duration || null,
                          formatFullPublishedDate(episode.publishedAt)
                        ].filter(Boolean).join(' • ')}
                        primaryLinkProps={topicHubCardEventProps(episode.slug, section.id, `/episodes/${episode.slug}`)}
                        secondaryLinkProps={topicHubCardEventProps(episode.slug, section.id, `/episodes/${episode.slug}`)}
                      />
                    ))}
                  </div>
                </section>
              </div>
            );
          }

          const sectionClassName =
            section.styleVariant === 'plain'
              ? 'scroll-mt-24 space-y-6'
              : index % 2 === 0
                ? 'scroll-mt-24 space-y-6 rounded-[30px] border border-carnival-ink/10 bg-white p-5 md:p-7'
                : 'scroll-mt-24 space-y-6 rounded-[30px] border border-carnival-ink/10 bg-[linear-gradient(140deg,#fff8f2_0%,#fff_48%,#faf8f4_100%)] p-5 md:p-7';

          return (
            <section key={section.id} id={section.id} className={sectionClassName}>
              <div className="max-w-3xl space-y-3">
                <p className={sectionBadgeClass}>{config.sectionEyebrow}</p>
                <h2 className="text-3xl font-black tracking-tight text-carnival-ink md:text-4xl">{section.title}</h2>
                <p className="text-base leading-7 text-carnival-ink/72 md:text-lg">{section.intro}</p>
              </div>
              <div className={getSectionGridClass(visibleEpisodes.length)}>
                {visibleEpisodes.map((episode) => (
                  <HomepageEpisodeCard
                    key={`${section.id}-${episode.id}`}
                    href={`/episodes/${episode.slug}`}
                    title={episode.title}
                    artworkSrc={episode.artworkUrl || '/The Compendium Main.jpg'}
                    artworkAlt={`${episode.title} artwork`}
                    eyebrow={episode.primaryTopicName || 'Featured episode'}
                    publishedDate={formatFullPublishedDate(episode.publishedAt)}
                    duration={episode.duration || null}
                    authorName={episode.authorName || null}
                    blurb={episode.description}
                    mobileSummary={episode.description}
                    mobileMeta={[
                      episode.episodeNumber ? `Ep ${episode.episodeNumber}` : null,
                      episode.duration || null,
                      formatFullPublishedDate(episode.publishedAt)
                    ].filter(Boolean).join(' • ')}
                    primaryLinkProps={topicHubCardEventProps(episode.slug, section.id, `/episodes/${episode.slug}`)}
                    secondaryLinkProps={topicHubCardEventProps(episode.slug, section.id, `/episodes/${episode.slug}`)}
                  />
                ))}
              </div>
            </section>
          );
        })}

        {relatedArticlesConfig && relatedArticles.length > 0 ? (
          <section className="space-y-6">
            <div className="max-w-3xl space-y-3">
              <p className={sectionBadgeClass}>{relatedArticlesConfig.eyebrow}</p>
              <h2 className="text-3xl font-black tracking-tight text-carnival-ink md:text-4xl">{relatedArticlesConfig.heading}</h2>
              <p className="text-base leading-7 text-carnival-ink/72 md:text-lg">{relatedArticlesConfig.intro}</p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              {relatedArticles.map((post) => (
                <BlogPostCard key={post.id} post={mapRelatedPost(post)} compact />
              ))}
            </div>
          </section>
        ) : null}

        <section className="my-6 grid gap-0 lg:grid-cols-[0.95fr_1.05fr] lg:gap-5 md:my-8">
          <div className="full-bleed rounded-none border-0 bg-[radial-gradient(circle_at_top_left,rgba(185,28,28,0.2),transparent_34%),linear-gradient(135deg,#171325_0%,#1f172f_55%,#281a12_100%)] py-20 text-white md:ml-0 md:w-auto md:rounded-[28px] md:border md:border-carnival-ink/10 md:p-8">
            <div className="mx-auto max-w-6xl px-6 md:max-w-none md:px-0">
              <p className={sectionBadgeClass}>{config.whyListen.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight md:text-4xl">{config.whyListen.heading}</h2>
              <p className="mt-4 text-base leading-7 text-white/80 md:text-lg">{config.whyListen.intro}</p>
              <ul className="mt-5 space-y-2.5 text-sm font-semibold text-white/84 md:text-base">
                {config.whyListen.points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-carnival-gold" aria-hidden="true" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="full-bleed rounded-none border-0 bg-[linear-gradient(180deg,#fff,#fcfaf5)] py-20 md:ml-0 md:w-auto md:rounded-[30px] md:border md:border-carnival-ink/8 md:p-10 md:shadow-[0_16px_44px_rgba(17,24,39,0.06)]">
            <div className="mx-auto max-w-6xl px-6 md:max-w-none md:px-0">
              <p className={sectionBadgeClass}>{config.faq.eyebrow}</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-carnival-ink md:text-4xl">{config.faq.heading}</h2>
              {config.faq.supportingLine ? (
                <p className="mt-3 text-base leading-7 text-carnival-ink/62 md:text-lg">{config.faq.supportingLine}</p>
              ) : null}
              <div className="mt-8 divide-y divide-carnival-ink/10">
                {config.faq.items.map((item) => (
                  <article key={item.question} className="py-6 first:pt-0 last:pb-0 md:py-7">
                    <h3 className="text-lg font-black leading-tight text-carnival-ink md:text-[1.32rem]">{item.question}</h3>
                    <p className="mt-3 max-w-[65ch] text-base leading-7 text-carnival-ink/68">{item.answer}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="full-bleed px-4 py-16 md:py-20" style={{ backgroundColor: 'var(--brand-cream)' }}>
          <div className="mx-auto max-w-6xl space-y-6">
            <div className="max-w-3xl space-y-3">
              <p className={sectionBadgeClass}>{config.relatedTopics.eyebrow}</p>
              <h2 className="text-3xl font-black tracking-tight text-carnival-ink md:text-4xl">{config.relatedTopics.heading}</h2>
              <p className="text-base leading-7 text-carnival-ink/82 md:text-lg">{config.relatedTopics.intro}</p>
            </div>
            <div className="grid gap-5 md:grid-cols-3">
              {config.relatedTopics.topics.map((topic) => (
                <HomepageTopicCard
                  key={topic.href}
                  href={topic.href}
                  title={topic.displayTitle || topic.title}
                  description={topic.description}
                  backgroundUrl={topic.backgroundImageUrl || null}
                  eventProps={relatedTopicEventProps(topic.href)}
                />
              ))}
            </div>
            <div className="flex justify-center pt-1">
              <Link href="/topics" className="btn-primary">
                Browse all topics
              </Link>
            </div>
          </div>
        </section>

        <section className="full-bleed relative overflow-hidden bg-carnival-ink px-4 py-20 text-white md:py-24">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute -left-24 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-carnival-red/18 blur-[120px]" />
            <div className="absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-carnival-gold/14 blur-[110px]" />
          </div>
          <div className="relative mx-auto max-w-6xl">
            <div className="max-w-3xl space-y-3">
              <p className={sectionBadgeClass}>{config.finalCta.eyebrow}</p>
              <h2 className="text-3xl font-black tracking-tight text-white md:text-4xl">{config.finalCta.heading}</h2>
              <p className="text-base leading-7 text-white/84 md:text-lg">{config.finalCta.body}</p>
            </div>
            <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap sm:items-center">
              {config.finalCta.primaryAction.external ? (
                <a
                  href={config.finalCta.primaryAction.href}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary h-11 px-5"
                  {...archiveEventProps(config.finalCta.primaryAction.href)}
                >
                  {config.finalCta.primaryAction.label}
                </a>
              ) : (
                <Link
                  href={config.finalCta.primaryAction.href}
                  className="btn-primary h-11 px-5"
                  {...archiveEventProps(config.finalCta.primaryAction.href)}
                >
                  {config.finalCta.primaryAction.label}
                </Link>
              )}
              {config.finalCta.secondaryAction ? (
                config.finalCta.secondaryAction.external ? (
                  <a
                    href={config.finalCta.secondaryAction.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-11 items-center justify-center rounded-md border border-carnival-gold/45 bg-transparent px-5 text-sm font-bold text-carnival-gold transition hover:bg-carnival-gold/15"
                  >
                    {config.finalCta.secondaryAction.label}
                  </a>
                ) : (
                  <Link
                    href={config.finalCta.secondaryAction.href}
                    className="inline-flex h-11 items-center justify-center rounded-md border border-carnival-gold/45 bg-transparent px-5 text-sm font-bold text-carnival-gold transition hover:bg-carnival-gold/15"
                  >
                    {config.finalCta.secondaryAction.label}
                  </Link>
                )
              ) : null}
            </div>
          </div>
        </section>

      </div>
      </section>
    </>
  );
}
