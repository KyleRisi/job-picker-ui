import { unstable_noStore as noStore } from 'next/cache';
import { redirect } from 'next/navigation';
import { listBlogPostsAdmin, createBlogPost } from '@/lib/blog/data';
import { WorkspaceBlogsTable } from '@/components/workspace/workspace-blogs-table';
import { NewPostButton } from './new-post-button';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function createNewPost() {
  'use server';
  const post = await createBlogPost();
  redirect(`/workspace/dashboard/blogs/${post.id}`);
}

const PAGE_SIZE = 100;

type WorkspaceBlogPost = Awaited<ReturnType<typeof listBlogPostsAdmin>>['items'][number];

function getPrimaryDate(post: WorkspaceBlogPost) {
  return post.published_at || post.scheduled_at || post.updated_at || null;
}

async function listAllBlogPosts() {
  const firstPage = await listBlogPostsAdmin({
    page: 1,
    pageSize: PAGE_SIZE,
    sort: 'published'
  });

  if (firstPage.pagination.totalPages <= 1) {
    return firstPage.items;
  }

  const requests: Array<Promise<Awaited<ReturnType<typeof listBlogPostsAdmin>>>> = [];
  for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
    requests.push(
      listBlogPostsAdmin({
        page,
        pageSize: PAGE_SIZE,
        sort: 'published'
      })
    );
  }

  const rest = await Promise.all(requests);
  const merged = [...firstPage.items, ...rest.flatMap((result) => result.items)];

  return merged.sort((a, b) => {
    const left = Date.parse(getPrimaryDate(a) || '') || 0;
    const right = Date.parse(getPrimaryDate(b) || '') || 0;
    return right - left;
  });
}

export default async function WorkspaceBlogsPage() {
  noStore();

  let posts: WorkspaceBlogPost[] = [];
  let loadError = '';

  try {
    posts = await listAllBlogPosts();
  } catch (error) {
    loadError = 'Could not load blog posts right now.';
    console.error('Workspace blogs failed to load:', error);
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Blogs</h1>
          <p className="text-sm text-slate-600">All blog posts from the database table.</p>
        </div>
        <NewPostButton action={createNewPost} />
      </header>

      {loadError ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>
      ) : null}

      <WorkspaceBlogsTable posts={posts} />
    </section>
  );
}
