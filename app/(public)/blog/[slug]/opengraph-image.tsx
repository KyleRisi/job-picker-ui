import { ImageResponse } from 'next/og';
import { getBlogPostBySlug } from '@/lib/blog/data';

export const size = {
  width: 1200,
  height: 630
};

export const contentType = 'image/png';

export default async function OgImage({ params }: { params: { slug: string } }) {
  const post = await getBlogPostBySlug(params.slug, {
    includeDraft: false,
    includeHeavyFields: false,
    includeRelatedPosts: false
  });
  const title = post?.title || 'The Compendium Blog';

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          height: '100%',
          width: '100%',
          background: 'linear-gradient(135deg, #f4e7bc 0%, #e8c775 45%, #b82018 100%)',
          padding: '56px',
          flexDirection: 'column',
          justifyContent: 'space-between',
          color: '#1b1635'
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 700 }}>The Compendium Podcast</div>
        <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.1, maxWidth: '92%' }}>{title}</div>
        <div style={{ fontSize: 26, fontWeight: 600 }}>Blog article</div>
      </div>
    ),
    size
  );
}
