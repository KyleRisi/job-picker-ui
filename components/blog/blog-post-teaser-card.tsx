import Link from 'next/link';
import Image from 'next/image';
import type { RelatedBlogPostSummary } from '@/lib/podcast-shared';
import { getStoragePublicUrl } from '@/lib/blog/media-url';

export function BlogPostTeaserCard({ post }: { post: RelatedBlogPostSummary }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-carnival-ink/15 bg-white shadow-card">
      {post.featuredImage ? (
        <Link href={`/blog/${post.slug}`} className="relative block aspect-[16/9]">
          <Image
            src={getStoragePublicUrl(post.featuredImage.storagePath)}
            alt={post.featuredImage.altText || post.title}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        </Link>
      ) : null}
      <div className="space-y-2 p-4">
        <h3 className="text-lg font-black text-carnival-ink">
          <Link href={`/blog/${post.slug}`} className="hover:text-carnival-red">
            {post.title}
          </Link>
        </h3>
        {post.excerpt ? <p className="line-clamp-3 text-sm text-carnival-ink/70">{post.excerpt}</p> : null}
      </div>
    </article>
  );
}
