import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { AdminPostEditor } from '@/components/blog/admin-post-editor';
import { getBlogPostAdminById, listBlogPostsAdmin, listBlogTaxonomies, listPodcastEpisodes } from '@/lib/blog/data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminBlogEditPage({ params }: { params: { id: string } }) {
  noStore();
  const [post, taxonomies, episodes, posts] = await Promise.all([
    getBlogPostAdminById(params.id),
    listBlogTaxonomies(),
    listPodcastEpisodes({ includeHidden: true }),
    listBlogPostsAdmin({ page: 1 })
  ]);

  if (!post) notFound();

  return (
    <AdminPostEditor
      key={post.id}
      initialPost={post}
      authors={taxonomies.authors.map((item) => ({ id: item.id, name: item.name }))}
      categories={taxonomies.categories.map((item) => ({ id: item.id, name: item.name }))}
      tags={taxonomies.tags.map((item) => ({ id: item.id, name: item.name }))}
      series={taxonomies.series.map((item) => ({ id: item.id, name: item.name }))}
      topicClusters={taxonomies.topicClusters.map((item) => ({ id: item.id, name: item.name }))}
      labels={taxonomies.labels.map((item) => ({ id: item.id, name: item.name }))}
      episodes={episodes.map((episode) => ({
        id: episode.id,
        title: episode.title,
        slug: episode.slug,
        publishedAt: episode.published_at,
        descriptionPlain: episode.description_plain,
        descriptionHtml: episode.description_html,
        audioUrl: episode.audio_url,
        artworkUrl: episode.artwork_url
      }))}
      relatedPostOptions={posts.items.map((item) => ({ id: item.id, title: item.title }))}
    />
  );
}
