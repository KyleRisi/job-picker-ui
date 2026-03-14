import Link from 'next/link';
import Image from 'next/image';
import { EpisodeMediaPlayer } from '@/components/episode-media-player';
import { CompactEpisodeRow, EpisodeCard } from '@/components/episodes-browser';
import { FeaturedEpisodeShowcase } from '@/components/featured-episode-showcase';
import { TranscriptBlock } from '@/components/blog/transcript-block';
import { getImageBlockLayout } from '@/lib/blog/image-layout';
import { getStoragePublicUrl } from '@/lib/blog/media-url';
import { toYouTubeEmbedUrl } from '@/lib/blog/youtube';
import type { BlogContentDocument, RichTextInlineNode } from '@/lib/blog/schema';
import type { MediaAssetRecord, PodcastEpisodeRecord } from '@/lib/blog/data';
import type { PodcastEpisode } from '@/lib/podcast-shared';

function decodeBasicEntities(input: string) {
  return input
    .replace(/&nbsp;/gi, '\u00a0')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function renderMarkdownishText(input: string) {
  const decoded = decodeBasicEntities(input || '');
  const boldRegex = /(\*\*[^*]+?\*\*|__[^_]+?__)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let key = 0;

  while ((match = boldRegex.exec(decoded)) !== null) {
    if (match.index > lastIndex) {
      parts.push(decoded.slice(lastIndex, match.index));
    }
    const raw = match[0];
    const boldText = raw.startsWith('**') ? raw.slice(2, -2) : raw.slice(2, -2);
    parts.push(<strong key={`md-bold-${key++}`}>{boldText}</strong>);
    lastIndex = match.index + raw.length;
  }

  if (!parts.length) return decoded;
  if (lastIndex < decoded.length) {
    parts.push(decoded.slice(lastIndex));
  }
  return parts;
}

function normalizeInlineHref(rawHref: string) {
  const href = `${rawHref || ''}`.trim();
  if (!href) return '#';
  if (href.startsWith('/') || href.startsWith('#')) return href;
  if (/^(https?:)?\/\//i.test(href)) return href;
  if (/^(mailto:|tel:)/i.test(href)) return href;
  return `https://${href}`;
}

function renderInline(nodes: RichTextInlineNode[], onDark = false) {
  const inlineCodeClass = onDark ? 'rounded bg-white/15 px-1 py-0.5 text-white' : 'rounded bg-carnival-ink/10 px-1 py-0.5';
  const linkClass = onDark ? 'text-carnival-gold underline underline-offset-2' : 'text-carnival-red underline underline-offset-2';

  return nodes.map((node, index) => {
    if (node.type === 'hard_break') return <br key={`br-${index}`} />;
    let content: React.ReactNode = renderMarkdownishText(node.text || '');
    (node.marks || []).forEach((mark) => {
      if (mark.type === 'bold') content = <strong key={`b-${index}`}>{content}</strong>;
      if (mark.type === 'italic') content = <em key={`i-${index}`}>{content}</em>;
      if (mark.type === 'underline') content = <span key={`u-${index}`} className="underline">{content}</span>;
      if (mark.type === 'strike') content = <span key={`s-${index}`} className="line-through">{content}</span>;
      if (mark.type === 'code') content = <code key={`c-${index}`} className={inlineCodeClass}>{content}</code>;
      if (mark.type === 'color') content = <span key={`color-${index}`} style={{ color: mark.value }}>{content}</span>;
      if (mark.type === 'font_size') content = <span key={`font-${index}`} style={{ fontSize: mark.value, lineHeight: 1.6 }}>{content}</span>;
      if (mark.type === 'link') {
        const normalizedHref = normalizeInlineHref(mark.href || '');
        const external = /^(https?:)?\/\//i.test(normalizedHref) || /^(mailto:|tel:)/i.test(normalizedHref);
        content = (
          <a
            key={`l-${index}`}
            href={normalizedHref}
            target={external ? '_blank' : undefined}
            rel={external ? 'noreferrer' : undefined}
            className={linkClass}
          >
            {content}
          </a>
        );
      }
    });
    return <span key={`txt-${index}`}>{content}</span>;
  });
}

function getAssetUrl(asset: MediaAssetRecord | undefined | null, src?: string) {
  if (asset) return getStoragePublicUrl(asset.storage_path);
  return src || '';
}

function normalizeCtaHref(rawHref: string) {
  const href = `${rawHref || ''}`.trim();
  if (!href) return '#';
  if (href.startsWith('/') || href.startsWith('#')) return href;
  if (/^(https?:)?\/\//i.test(href)) return href;
  if (/^(mailto:|tel:)/i.test(href)) return href;
  return `https://${href}`;
}

function toPodcastEpisodeCard(episode: PodcastEpisodeRecord): PodcastEpisode {
  return {
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
  };
}

export function BlogContentRenderer({
  document,
  assetMap,
  linkedEpisodes,
  relatedPosts,
  theme = 'light'
}: {
  document: BlogContentDocument;
  assetMap: Map<string, MediaAssetRecord>;
  linkedEpisodes: Array<{ episode: PodcastEpisodeRecord; is_primary: boolean }>;
  relatedPosts: Array<{ id: string; slug: string; title: string }>;
  theme?: 'light' | 'dark';
}) {
  const isDark = theme === 'dark';
  const textClass = isDark ? 'text-white/90' : 'text-carnival-ink/90';
  const headingClass = isDark ? 'text-white' : 'text-carnival-ink';
  const subtleTextClass = isDark ? 'text-white/70' : 'text-carnival-ink/70';
  const cardClass = isDark ? 'border-white/20 bg-white/10 text-white' : 'border-carnival-ink/15 bg-white';
  const cardSoftClass = isDark ? 'border-white/20 bg-white/10' : 'border-carnival-ink/15 bg-white';
  const accentLinkClass = isDark ? 'text-carnival-gold underline underline-offset-2' : 'text-carnival-red underline underline-offset-2';

  return (
    <div className="blog-rich space-y-6">
      {document.map((block) => {
        if (block.type === 'paragraph') {
          return (
            <p key={block.id} className={`text-lg leading-8 ${textClass}`} style={{ textAlign: block.align || 'left' }}>
              {renderInline(block.content, isDark)}
            </p>
          );
        }
        if (block.type === 'heading') {
          const Tag = `h${block.level}` as keyof JSX.IntrinsicElements;
          return (
            <Tag key={block.id} id={block.id} className={`scroll-mt-24 text-2xl font-black ${headingClass}`} style={{ textAlign: block.align || 'left' }}>
              {renderInline(block.content, isDark)}
            </Tag>
          );
        }
        if (block.type === 'list') {
          const Tag = block.style === 'ordered' ? 'ol' : 'ul';
          return (
            <Tag key={block.id} className={`ml-6 list-outside space-y-2 text-lg leading-8 ${textClass} ${block.style === 'ordered' ? 'list-decimal' : 'list-disc'}`}>
              {block.items.map((item) => (
                <li key={item.id}>{renderInline(item.content, isDark)}</li>
              ))}
            </Tag>
          );
        }
        if (block.type === 'blockquote') {
          return (
            <blockquote key={block.id} className={`rounded-2xl border-l-4 px-6 py-5 text-xl font-semibold italic shadow-card ${isDark ? 'border-carnival-gold bg-white/10 text-white' : 'border-carnival-red bg-white'}`}>
              <p>{renderInline(block.quote, isDark)}</p>
              {block.attribution ? <footer className={`mt-3 text-sm not-italic ${subtleTextClass}`}>{block.attribution}</footer> : null}
            </blockquote>
          );
        }
        if (block.type === 'cta_button') {
          const href = normalizeCtaHref(block.href);
          const external = /^(https?:)?\/\//i.test(href) || /^(mailto:|tel:)/i.test(href);
          const ctaClassName = 'btn-primary !text-white visited:!text-white hover:!text-white !no-underline hover:!no-underline';
          const alignClass = block.align === 'left' ? 'justify-start' : block.align === 'right' ? 'justify-end' : 'justify-center';
          return (
            <div key={block.id} className={`flex ${alignClass}`}>
              <a
                href={href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noreferrer' : undefined}
                className={ctaClassName}
              >
                {block.label}
              </a>
            </div>
          );
        }
        if (block.type === 'image') {
          const asset = block.assetId ? assetMap.get(block.assetId) : null;
          const imageUrl = getAssetUrl(asset, block.src);
          const captionText = block.caption || asset?.caption_default || '';
          const creditText = block.credit || asset?.credit_source || '';
          const imageLayout = getImageBlockLayout(block.size);
          return imageUrl ? (
            <figure key={block.id} className={`space-y-2 ${imageLayout.wrapperClassName}`}>
              <div className={`relative overflow-hidden rounded-2xl border ${isDark ? 'border-white/20 bg-white/5' : 'border-carnival-ink/15 bg-white'}`}>
                <Image
                  src={imageUrl}
                  alt={block.alt || asset?.alt_text_default || ''}
                  width={asset?.width || 1200}
                  height={asset?.height || 800}
                  sizes={imageLayout.sizes}
                  className="h-auto w-full object-cover"
                />
              </div>
              {(captionText || creditText) ? (
                <figcaption className={`space-y-1 text-sm ${subtleTextClass}`}>
                  {captionText ? <p>{captionText}</p> : null}
                  {creditText ? <p className="text-xs">Credit: {creditText}</p> : null}
                </figcaption>
              ) : null}
            </figure>
          ) : null;
        }
        if (block.type === 'divider') return <hr key={block.id} className={isDark ? 'border-white/20' : 'border-carnival-ink/15'} />;
        if (block.type === 'code_block') {
          return (
            <pre key={block.id} className="overflow-x-auto rounded-2xl bg-carnival-ink p-4 text-sm text-white">
              <code>{block.code}</code>
            </pre>
          );
        }
        if (block.type === 'youtube_embed') {
          const embedUrl = toYouTubeEmbedUrl(block.url);
          if (!embedUrl) return null;
          const videoLayout = getImageBlockLayout(block.size);
          return (
            <div key={block.id} className={videoLayout.wrapperClassName}>
              <div className={`overflow-hidden rounded-2xl border ${isDark ? 'border-white/20' : 'border-carnival-ink/15'}`}>
                <iframe
                  src={embedUrl}
                  title={block.title || 'YouTube video'}
                  loading="lazy"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  sandbox="allow-scripts allow-same-origin allow-popups"
                  className="aspect-video w-full"
                />
              </div>
            </div>
          );
        }
        if (block.type === 'video_embed') {
          return (
            <div key={block.id} className={`overflow-hidden rounded-2xl border ${isDark ? 'border-white/20' : 'border-carnival-ink/15'}`}>
              <iframe
                src={block.url}
                title={block.title || 'Video'}
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                sandbox="allow-scripts allow-same-origin allow-popups"
                className="aspect-video w-full"
              />
            </div>
          );
        }
        if (block.type === 'podcast_player') {
          const episode = linkedEpisodes.find((item) => item.episode.id === block.episodeId)?.episode || linkedEpisodes[0]?.episode;
          if (!episode) return null;
          return (
            <div key={block.id}>
              <EpisodeMediaPlayer
                episode={{
                  slug: episode.slug,
                  title: episode.title,
                  audioUrl: episode.audio_url,
                  artworkUrl: episode.artwork_url,
                  episodeNumber: null,
                  publishedAt: episode.published_at || new Date().toISOString(),
                  duration: null
                }}
              />
            </div>
          );
        }
        if (block.type === 'table') {
          return (
            <div key={block.id} className={`overflow-auto rounded-2xl border ${isDark ? 'border-white/20 bg-white/10 text-white' : 'border-carnival-ink/15 bg-white'}`}>
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className={isDark ? 'border-b border-white/20 bg-white/10' : 'border-b border-carnival-ink/10 bg-carnival-gold/20'}>
                    {block.headers.map((header, index) => (
                      <th key={`${block.id}-${index}`} className="px-4 py-3 font-black">{header}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={`${block.id}-row-${rowIndex}`} className={isDark ? 'border-b border-white/15 last:border-0' : 'border-b border-carnival-ink/10 last:border-0'}>
                      {row.map((cell, cellIndex) => (
                        <td key={`${block.id}-${rowIndex}-${cellIndex}`} className="px-4 py-3">{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        if (block.type === 'listen_episode') {
          const episode = linkedEpisodes[0]?.episode;
          if (!episode) return null;
          return (
            <FeaturedEpisodeShowcase
              key={block.id}
              heading={block.heading || 'Listen to the linked episode'}
              headingClassName="text-2xl font-black text-white"
            >
              <EpisodeCard episode={toPodcastEpisodeCard(episode)} featured featuredDesktopTextLarger />
            </FeaturedEpisodeShowcase>
          );
        }
        if (block.type === 'resources') {
          return (
            <section key={block.id} className="space-y-2">
              <h3 className={`text-xl font-black ${headingClass}`}>{block.heading}</h3>
              <ul className="space-y-1.5 pl-4">
                {block.items.map((item) => (
                  <li key={item.id} className="flex items-baseline gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 translate-y-[2px]"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    <span>
                      <a href={item.href} target="_blank" rel="noreferrer" className="font-semibold text-white/80 no-underline hover:text-white">
                        {item.label}
                      </a>
                      {item.description ? <span className={`text-sm ${subtleTextClass}`}>{' — '}{item.description}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        }
        if (block.type === 'related_episodes') {
          return linkedEpisodes.length ? (
            <section key={block.id} className="space-y-3">
              <h3 className={`text-xl font-black ${headingClass}`}>{block.heading}</h3>
              <ul className="space-y-4 [&_a]:!text-inherit [&_a]:!no-underline">
                {linkedEpisodes.map((item) => (
                  <li key={item.episode.id}>
                    <CompactEpisodeRow episode={toPodcastEpisodeCard(item.episode)} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null;
        }
        if (block.type === 'related_posts') {
          return relatedPosts.length ? (
            <section key={block.id} className="space-y-2">
              <h3 className={`text-xl font-black ${headingClass}`}>{block.heading}</h3>
              <ul className="space-y-1.5 pl-4">
                {relatedPosts.map((item) => (
                  <li key={item.id} className="flex items-baseline gap-1.5">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 translate-y-[2px]"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    <a href={`/blog/${item.slug}`} target="_blank" rel="noreferrer" className="font-semibold text-white/80 no-underline hover:text-white">
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null;
        }
        if (block.type === 'faq') {
          return (
            <section key={block.id} className="space-y-2">
              <h3 className={`text-xl font-black ${headingClass}`}>{block.heading}</h3>
              <div className="space-y-1.5 pl-4">
                {block.items.map((item) => (
                  <details key={item.id} className="group">
                    <summary className={`flex cursor-pointer items-baseline gap-1.5 font-bold ${isDark ? 'text-white/80 hover:text-white' : 'text-carnival-ink/85 hover:text-carnival-ink'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 translate-y-[2px] transition group-open:rotate-90"><polyline points="9 18 15 12 9 6"/></svg>
                      {item.question}
                    </summary>
                    <div className={`mt-1.5 pl-[22px] ${isDark ? 'text-white/85' : 'text-carnival-ink/85'}`}>{renderInline(item.answer, isDark)}</div>
                  </details>
                ))}
              </div>
            </section>
          );
        }
        if (block.type === 'transcript') {
          return (
            <TranscriptBlock
              key={block.id}
              heading={block.heading || 'Episode transcript'}
              content={block.content}
              theme={theme}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
