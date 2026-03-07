import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { listBlogPostsAdmin } from '@/lib/blog/data';
import { CreatePostButton } from '@/components/blog/create-post-button';
import { AdminBlogListActions } from '@/components/blog/admin-blog-list-actions';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function formatPublishedDate(value: string | null) {
  if (!value) return 'Draft';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Draft';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatUpdatedDate(value: string | null) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-GB');
}

function StatusPill({ status }: { status: string }) {
  const tones: Record<string, string> = {
    published: 'bg-emerald-100 text-emerald-800',
    draft: 'bg-stone-200 text-stone-700',
    scheduled: 'bg-amber-100 text-amber-800',
    archived: 'bg-slate-200 text-slate-700'
  };

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] ${tones[status] || tones.draft}`}>
      {status}
    </span>
  );
}

async function listAllBlogPosts() {
  const posts: Awaited<ReturnType<typeof listBlogPostsAdmin>>['items'] = [];
  let page = 1;

  while (true) {
    const result = await listBlogPostsAdmin({
      page,
      pageSize: 100,
      sort: 'published'
    });
    posts.push(...result.items);
    if (page >= result.pagination.totalPages) break;
    page += 1;
  }

  return posts;
}

export default async function AdminBlogPage() {
  noStore();

  let posts: Awaited<ReturnType<typeof listBlogPostsAdmin>>['items'] = [];
  let loadError = '';

  try {
    posts = await listAllBlogPosts();
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Failed to load blog posts.';
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-4xl font-black">Compendium Blog</h1>
          <span className="rounded-full bg-carnival-red px-3 py-1 text-sm font-bold text-white">
            {posts.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/blog/import" className="btn-secondary !bg-[#32466f] hover:!bg-[#2a3b5f]">
            Import
          </Link>
          <CreatePostButton
            label="+ New Post"
            className="btn-secondary"
          />
        </div>
      </div>

      {loadError ? (
        <div className="rounded-xl border border-[#efb3b3] bg-[#fff2f2] px-4 py-3 text-sm font-semibold text-[#8d1010]">
          {loadError}
        </div>
      ) : null}

      <section className="card overflow-visible">
        <table className="mt-3 min-w-full text-left text-sm">
          <thead>
            <tr>
              <th className="pb-3 pr-3">Post Title</th>
              <th className="pb-3 pr-3">Date Published</th>
              <th className="pb-3 pr-3">Status</th>
              <th className="pb-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loadError ? (
              <tr className="border-t">
                <td colSpan={4} className="py-6 text-sm text-carnival-ink/70">
                  Unable to load posts.
                </td>
              </tr>
            ) : posts.length ? posts.map((post) => (
              <tr key={post.id} className="border-t">
                <td className="py-2.5 pr-3 align-middle">
                  <p className="text-[1.05rem] font-semibold leading-tight text-[#24313c]">
                    {post.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-xs text-black/48">
                    <span>/{post.slug}</span>
                    <span>Updated {formatUpdatedDate(post.updated_at)}</span>
                    {post.taxonomies?.categories?.[0] ? <span>{post.taxonomies.categories[0].name}</span> : null}
                  </div>
                </td>
                <td className="py-2.5 pr-3 align-middle text-[0.98rem] font-semibold text-[#24313c]">
                  {formatPublishedDate(post.published_at)}
                </td>
                <td className="py-2.5 pr-3 align-middle">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={post.status} />
                    {post.is_featured ? (
                      <span className="inline-flex rounded-full bg-[#efe5c9] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-[#7a5a07]">
                        Featured
                      </span>
                    ) : null}
                  </div>
                </td>
                <AdminBlogListActions postId={post.id} slug={post.slug} status={post.status} />
              </tr>
            )) : (
              <tr className="border-t">
                <td colSpan={4} className="py-6 text-sm text-carnival-ink/70">
                  No posts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </section>
  );
}
