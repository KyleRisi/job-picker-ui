import Link from 'next/link';
import Image from 'next/image';
import { getStoragePublicUrl } from '@/lib/blog/media-url';
import type { MediaAssetRecord } from '@/lib/blog/data';

type BlogPostCardPost = {
  id?: string;
  slug: string;
  title: string;
  excerpt: string | null;
  excerpt_auto?: string | null;
  published_at: string | null;
  is_featured?: boolean;
  reading_time_minutes: number | null;
  featured_image: Pick<MediaAssetRecord, 'storage_path' | 'alt_text_default'> | null;
  taxonomies?: { categories?: Array<{ id: string; name: string; slug: string }> };
  author?: { name: string; slug: string } | null;
};

export function BlogPostCard({
  post,
  featured = false,
  compact = false,
  onDark = false
}: {
  post: BlogPostCardPost;
  featured?: boolean;
  compact?: boolean;
  onDark?: boolean;
}) {
  const imageUrl = post.featured_image ? getStoragePublicUrl(post.featured_image.storage_path) : null;
  const category = post.taxonomies?.categories?.[0];
  const excerpt = post.excerpt || post.excerpt_auto || 'Read the full article.';
  const cardClass = onDark ? 'border-white/20 bg-white/10 text-white' : 'border-carnival-ink/15 bg-white';
  const imageBgClass = onDark ? 'bg-white/10' : 'bg-carnival-ink/5';
  const categoryClass = onDark
    ? 'bg-white/15 text-white hover:bg-white/20'
    : 'bg-carnival-gold/30 text-carnival-ink hover:bg-carnival-gold/40';
  const titleLinkClass = onDark ? 'hover:text-carnival-gold' : 'hover:text-carnival-red';
  const excerptClass = onDark ? 'text-white/80' : 'text-carnival-ink/75';
  const metaClass = onDark ? 'text-white/70' : 'text-carnival-ink/65';

  if (compact) {
    return (
      <article className={`h-full overflow-hidden rounded-2xl border-2 shadow-card ${cardClass}`}>
        {imageUrl ? (
          <Link href={`/blog/${post.slug}`} className={`relative block aspect-[16/10] ${imageBgClass}`}>
            <Image
              src={imageUrl}
              alt={post.featured_image?.alt_text_default || post.title}
              fill
              sizes="(max-width: 768px) 80vw, (max-width: 1024px) 40vw, 30vw"
              className="object-cover"
            />
          </Link>
        ) : null}
        <div className="space-y-3 p-4">
          {category ? (
            <Link href={`/blog/category/${category.slug}`} className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide transition ${categoryClass}`}>
              {category.name}
            </Link>
          ) : null}
          <h3 className="text-xl font-black leading-tight">
            <Link href={`/blog/${post.slug}`} className={titleLinkClass}>
              {post.title}
            </Link>
          </h3>
          <p className={`line-clamp-3 text-sm ${excerptClass}`}>{excerpt}</p>
          <div className={`flex flex-wrap items-center gap-3 text-xs ${metaClass}`}>
            {post.author ? <Link href={`/blog/author/${post.author.slug}`}>{post.author.name}</Link> : null}
            {post.published_at ? <span>{new Date(post.published_at).toLocaleDateString('en-GB')}</span> : null}
            {post.reading_time_minutes ? <span>{post.reading_time_minutes} min read</span> : null}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className={`overflow-hidden rounded-2xl border-2 shadow-card ${cardClass} ${featured ? 'lg:grid lg:grid-cols-[1.2fr_1fr]' : ''}`}>
      {imageUrl ? (
        <div className={`relative min-h-[220px] ${imageBgClass}`}>
          <Image
            src={imageUrl}
            alt={post.featured_image?.alt_text_default || post.title}
            fill
            sizes={featured ? '(max-width: 1024px) 100vw, 55vw' : '(max-width: 768px) 100vw, 33vw'}
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="space-y-3 p-6">
        {category ? (
          <Link href={`/blog/category/${category.slug}`} className={`inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide transition ${categoryClass}`}>
            {category.name}
          </Link>
        ) : null}
        <h2 className={featured ? 'text-3xl font-black' : 'text-2xl font-black'}>
          <Link href={`/blog/${post.slug}`} className={titleLinkClass}>
            {post.title}
          </Link>
        </h2>
        <p className={excerptClass}>
          {excerpt}
        </p>
        <div className={`flex flex-wrap items-center gap-3 text-sm ${metaClass}`}>
          {post.author ? <Link href={`/blog/author/${post.author.slug}`}>{post.author.name}</Link> : null}
          {post.published_at ? <span>{new Date(post.published_at).toLocaleDateString('en-GB')}</span> : null}
          {post.reading_time_minutes ? <span>{post.reading_time_minutes} min read</span> : null}
        </div>
        <Link
          href={`/blog/${post.slug}`}
          className={onDark ? 'btn rounded-md border border-white/25 bg-white/10 px-4 py-2 font-black text-white hover:bg-white/20' : 'btn-primary'}
          aria-label={`Read post: ${post.title}`}
        >
          Read post
        </Link>
      </div>
    </article>
  );
}
