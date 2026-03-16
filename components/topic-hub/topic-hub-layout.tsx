import Link from 'next/link';
import { BlogPostCard } from '@/components/blog/blog-post-card';
import { EpisodeCard } from '@/components/episodes-browser';
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

export function TopicHubLayout({ hub, featuredEpisodes, groupedSections, config }: TopicHubLayoutProps) {
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

  return (
    <>
      <section className="full-bleed relative -mt-8 overflow-hidden bg-carnival-ink pb-11 pt-14 text-white md:pb-14 md:pt-18">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(185,28,28,0.28),transparent_28%),radial-gradient(circle_at_top_right,rgba(245,158,11,0.14),transparent_24%),linear-gradient(135deg,#111827_0%,#171325_45%,#22130f_100%)]" />
          <div className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-carnival-red/20 blur-[110px]" />
          <div className="absolute -right-16 bottom-0 h-80 w-80 rounded-full bg-carnival-gold/15 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="max-w-[780px]">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-carnival-gold">{config.hero.eyebrow}</p>
            <h1 className="mt-5 max-w-3xl text-[30px] font-black leading-[1.06] tracking-tight text-white sm:text-[40px] md:text-[50px]">
              {config.hero.title}
            </h1>
            <p className="mt-6 max-w-[62ch] text-[16px] leading-[1.9] text-white/84 md:text-[18px] md:leading-[1.95]">
              {config.hero.intro}
            </p>
            <div className="mt-9 flex flex-col items-start gap-3.5 sm:flex-row sm:flex-wrap sm:items-center">
              <Link
                href={config.hero.primaryAction.href}
                className="inline-flex w-full items-center justify-center rounded-full bg-carnival-red px-6 py-3.5 text-sm font-black uppercase tracking-[0.12em] text-white shadow-[0_10px_30px_rgba(185,28,28,0.35)] transition hover:brightness-110 sm:w-auto"
              >
                {config.hero.primaryAction.label}
              </Link>
              <Link
                href={config.hero.secondaryAction.href}
                className="inline-flex w-full items-center justify-center rounded-full border border-carnival-gold/60 bg-carnival-gold/14 px-5 py-3 text-sm font-black tracking-[0.08em] text-carnival-gold transition hover:border-carnival-gold hover:bg-carnival-gold/20 sm:w-auto"
              >
                {config.hero.secondaryAction.label}
              </Link>
              {config.hero.tertiaryAction ? (
                <a
                  href={config.hero.tertiaryAction.href}
                  target={config.hero.tertiaryAction.external ? '_blank' : undefined}
                  rel={config.hero.tertiaryAction.external ? 'noreferrer' : undefined}
                  className="inline-flex items-center px-1 py-1 text-xs font-black uppercase tracking-[0.12em] text-white/60 underline-offset-4 transition hover:text-white/85 hover:underline sm:ml-1"
                >
                  {config.hero.tertiaryAction.label}
                </a>
              ) : null}
            </div>
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
      </section>

      <section className="mx-auto max-w-6xl space-y-10 px-4 py-10 md:space-y-14 md:py-14">
        <section id={config.startHere.sectionId} className="scroll-mt-24 space-y-6">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-carnival-red">{config.startHere.eyebrow}</p>
            <h2 className="text-3xl font-black tracking-tight text-carnival-ink md:text-4xl">{config.startHere.heading}</h2>
            <p className="text-base leading-7 text-carnival-ink/72 md:text-lg">{config.startHere.intro}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {featuredEpisodes.map((episode) => (
              <EpisodeCard
                key={episode.id}
                episode={episode}
                featured={false}
                showInlinePlayer={config.showInlinePlayer}
              />
            ))}
          </div>
        </section>

        {caseTypeChips.length > 0 ? (
          <section className="full-bleed -mt-2 bg-carnival-ink px-4 py-14 text-white md:-mt-3 md:py-16">
            <div className="mx-auto max-w-6xl text-center">
              <div className="mx-auto max-w-3xl space-y-3">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-carnival-gold">{config.chips.eyebrow}</p>
                <h2 className="text-2xl font-black tracking-tight md:text-3xl">{config.chips.heading}</h2>
                <p className="text-sm leading-7 text-white/72 md:text-base">{config.chips.intro}</p>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                {caseTypeChips.map((chip) => (
                  <a
                    key={chip.href}
                    href={chip.href}
                    className="inline-flex items-center rounded-full border border-carnival-gold/35 bg-carnival-ink/50 px-4 py-2.5 text-sm font-semibold text-white/92 transition hover:border-carnival-red/45 hover:bg-carnival-ink/70"
                  >
                    {chip.label}
                  </a>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        {groupedSections.map((section, index) => {
          const visibleEpisodes = section.maxVisibleEpisodes
            ? section.episodes.slice(0, section.maxVisibleEpisodes)
            : section.episodes;

          if (section.styleVariant === 'full-bleed-gold') {
            return (
              <div key={section.id} className="full-bleed !mt-0 bg-carnival-gold py-8 md:py-10">
                <section id={section.id} className="mx-auto max-w-6xl scroll-mt-24 space-y-6 px-4">
                  <div className="max-w-3xl space-y-3">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-carnival-red">{config.sectionEyebrow}</p>
                    <h2 className="text-3xl font-black tracking-tight text-carnival-ink md:text-4xl">{section.title}</h2>
                    <p className="text-base leading-7 text-carnival-ink/72 md:text-lg">{section.intro}</p>
                  </div>
                  <div className={getSectionGridClass(visibleEpisodes.length)}>
                    {visibleEpisodes.map((episode) => (
                      <EpisodeCard
                        key={`${section.id}-${episode.id}`}
                        episode={episode}
                        featured={false}
                        showInlinePlayer={config.showInlinePlayer}
                      />
                    ))}
                  </div>
                </section>
              </div>
            );
          }

          if (section.styleVariant === 'mobile-full-bleed-panel') {
            return (
              <div key={section.id} className="full-bleed border-y border-carnival-ink/10 bg-[#f8f6f1] py-5 md:border-0 md:bg-transparent md:py-0">
                <section
                  id={section.id}
                  className="mx-auto max-w-6xl scroll-mt-24 space-y-6 px-4 md:rounded-[30px] md:border md:border-carnival-ink/10 md:bg-white md:p-7"
                >
                  <div className="max-w-3xl space-y-3">
                    <p className="text-xs font-black uppercase tracking-[0.24em] text-carnival-red">{config.sectionEyebrow}</p>
                    <h2 className="text-3xl font-black tracking-tight text-carnival-ink md:text-4xl">{section.title}</h2>
                    <p className="text-base leading-7 text-carnival-ink/72 md:text-lg">{section.intro}</p>
                  </div>
                  <div className={getSectionGridClass(visibleEpisodes.length)}>
                    {visibleEpisodes.map((episode) => (
                      <EpisodeCard
                        key={`${section.id}-${episode.id}`}
                        episode={episode}
                        featured={false}
                        showInlinePlayer={config.showInlinePlayer}
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
                <p className="text-xs font-black uppercase tracking-[0.24em] text-carnival-red">{config.sectionEyebrow}</p>
                <h2 className="text-3xl font-black tracking-tight text-carnival-ink md:text-4xl">{section.title}</h2>
                <p className="text-base leading-7 text-carnival-ink/72 md:text-lg">{section.intro}</p>
              </div>
              <div className={getSectionGridClass(visibleEpisodes.length)}>
                {visibleEpisodes.map((episode) => (
                  <EpisodeCard
                    key={`${section.id}-${episode.id}`}
                    episode={episode}
                    featured={false}
                    showInlinePlayer={config.showInlinePlayer}
                  />
                ))}
              </div>
            </section>
          );
        })}

        <section className="full-bleed bg-carnival-ink px-4 py-[156px] text-white md:py-[180px]">
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 text-center md:gap-8">
            <div className="space-y-2">
              <h3 className="text-3xl font-black md:text-4xl">{config.archiveHighlight.heading}</h3>
              <p className="max-w-3xl text-sm leading-7 text-white/75 md:text-base">{config.archiveHighlight.body}</p>
            </div>
            <div>
              <Link
                href={config.archiveHighlight.action.href}
                className="inline-flex items-center rounded-full bg-carnival-red px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:brightness-110"
              >
                {config.archiveHighlight.action.label}
              </Link>
            </div>
          </div>
        </section>

        {relatedArticlesConfig && relatedArticles.length > 0 ? (
          <section className="space-y-6">
            <div className="max-w-3xl space-y-3">
              <p className="text-xs font-black uppercase tracking-[0.24em] text-carnival-red">{relatedArticlesConfig.eyebrow}</p>
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

        <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[28px] border border-carnival-ink/10 bg-[radial-gradient(circle_at_top_left,rgba(185,28,28,0.2),transparent_34%),linear-gradient(135deg,#171325_0%,#1f172f_55%,#281a12_100%)] p-6 text-white md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-carnival-red">{config.whyListen.eyebrow}</p>
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

          <div className="rounded-[30px] border border-carnival-ink/8 bg-[linear-gradient(180deg,#fff,#fcfaf5)] p-7 shadow-[0_16px_44px_rgba(17,24,39,0.06)] md:p-10">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-carnival-red/80">{config.faq.eyebrow}</p>
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
        </section>

        <section className="space-y-6">
          <div className="max-w-3xl space-y-3">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-carnival-red">{config.relatedTopics.eyebrow}</p>
            <h2 className="text-3xl font-black tracking-tight text-carnival-ink md:text-4xl">{config.relatedTopics.heading}</h2>
            <p className="text-base leading-7 text-carnival-ink/72 md:text-lg">{config.relatedTopics.intro}</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {config.relatedTopics.topics.map((topic) => (
              <Link
                key={topic.href}
                href={topic.href}
                className="group rounded-[28px] border border-carnival-red/55 bg-carnival-red p-6 shadow-card transition duration-200 hover:-translate-y-1 hover:brightness-105 hover:shadow-[0_24px_60px_rgba(120,20,20,0.28)]"
              >
                <p className="text-xs font-black uppercase tracking-[0.2em] text-carnival-gold">{topic.label}</p>
                <h3 className="mt-3 text-2xl font-black leading-tight text-white">{topic.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white md:text-base">{topic.description}</p>
                <div className="mt-5 inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.12em] text-white">
                  <span>{topic.ctaLabel}</span>
                  <span aria-hidden="true">&rarr;</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </section>

      <section className="full-bleed relative -mb-8 overflow-hidden bg-carnival-ink py-[164px] text-white md:py-[180px]">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,rgba(185,28,28,0.24),transparent_24%),radial-gradient(circle_at_right,rgba(245,158,11,0.16),transparent_20%),linear-gradient(135deg,#111827_0%,#16111f_60%,#23140d_100%)]" />
        </div>
        <div className="relative mx-auto flex max-w-5xl flex-col items-start gap-7 px-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-carnival-gold">{config.finalCta.eyebrow}</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight md:text-[42px]">{config.finalCta.heading}</h2>
            <p className="mt-3 text-base leading-7 text-white/78 md:text-lg">{config.finalCta.body}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href={config.finalCta.primaryAction.href}
              className="inline-flex items-center rounded-full bg-carnival-red px-6 py-3.5 text-sm font-black uppercase tracking-[0.12em] text-white shadow-[0_12px_35px_rgba(185,28,28,0.35)] transition hover:brightness-110"
            >
              {config.finalCta.primaryAction.label}
            </Link>
            {config.finalCta.secondaryAction ? (
              <a
                href={config.finalCta.secondaryAction.href}
                target={config.finalCta.secondaryAction.external ? '_blank' : undefined}
                rel={config.finalCta.secondaryAction.external ? 'noreferrer' : undefined}
                className="inline-flex items-center rounded-full border border-white/25 bg-white/8 px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-white/16"
              >
                {config.finalCta.secondaryAction.label}
              </a>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
