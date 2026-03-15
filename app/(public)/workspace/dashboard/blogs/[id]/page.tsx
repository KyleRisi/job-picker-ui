import { notFound } from 'next/navigation';
import { getBlogPostAdminById, listBlogAuthors, listBlogPostsAdmin, listPodcastEpisodes } from '@/lib/blog/data';
import { listActiveDiscoveryTerms } from '@/lib/episodes';
import { WorkspaceBlogEditor } from '@/components/workspace/workspace-blog-editor';
import { isApprovedCollectionSlug, isApprovedTopicSlug } from '@/lib/taxonomy-route-policy';

export default async function BlogEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post, episodeRows, postRows, authorRows, discoveryTerms] = await Promise.all([
    getBlogPostAdminById(id),
    listPodcastEpisodes({ includeHidden: true }),
    listBlogPostsAdmin({ pageSize: 100, includeDeleted: false, sort: 'updated' }),
    listBlogAuthors(),
    listActiveDiscoveryTerms()
  ]);
  if (!post) notFound();

  const episodes = episodeRows.map((episode) => ({
    id: episode.id,
    title: episode.title,
    slug: episode.slug,
    audioUrl: episode.audio_url,
    artworkUrl: episode.artwork_url,
    episodeNumber: episode.episode_number,
    publishedAt: episode.published_at
  }));
  const relatedPosts = (postRows.items || [])
    .filter((item) => item.id !== post.id)
    .map((item) => ({ id: item.id, title: item.title }));
  const authors = (authorRows || []).map((author) => ({ id: author.id, name: author.name }));
  const taxonomyOptions = {
    categories: discoveryTerms
      .filter((term) => term.termType === 'topic' && isApprovedTopicSlug(term.slug))
      .map((term) => ({ id: term.id, name: term.name })),
    topics: discoveryTerms
      .filter((term) => term.termType === 'topic' && isApprovedTopicSlug(term.slug))
      .map((term) => ({ id: term.id, name: term.name })),
    themes: discoveryTerms.filter((term) => term.termType === 'theme').map((term) => ({ id: term.id, name: term.name })),
    collections: discoveryTerms
      .filter((term) => term.termType === 'collection' && isApprovedCollectionSlug(term.slug))
      .map((term) => ({ id: term.id, name: term.name })),
    series: discoveryTerms.filter((term) => term.termType === 'series').map((term) => ({ id: term.id, name: term.name }))
  };

  return (
    <WorkspaceBlogEditor
      post={post as any}
      episodes={episodes}
      relatedPosts={relatedPosts}
      authors={authors}
      taxonomyOptions={taxonomyOptions}
    />
  );
}
