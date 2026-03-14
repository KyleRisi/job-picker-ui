import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';
import { listBlogPostsAdmin } from '@/lib/blog/data';
import { CreatePostButton } from '@/components/blog/create-post-button';
import { AdminBlogListActions } from '@/components/blog/admin-blog-list-actions';
import { AdminBlogStatusFilter } from '@/components/blog/admin-blog-status-filter';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
const PAGE_SIZE = 20;

type BlogStatusFilter = 'all' | 'draft' | 'published' | 'scheduled' | 'archived';

function formatPublishDate(post: {
  status: string;
  published_at: string | null;
  scheduled_at?: string | null;
}) {
  const value = post.published_at || post.scheduled_at || null;
  if (!value) {
    if (post.status === 'scheduled') return 'Scheduled';
    if (post.status === 'published') return 'Published';
    return 'Draft';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    if (post.status === 'scheduled') return 'Scheduled';
    return 'Draft';
  }
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

function resolvePrimaryDateTimestamp(post: {
  published_at: string | null;
  scheduled_at?: string | null;
}) {
  const value = post.published_at || post.scheduled_at || null;
  if (!value) return Number.NEGATIVE_INFINITY;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function byPrimaryDateDescending(
  a: {
    published_at: string | null;
    scheduled_at?: string | null;
  },
  b: {
    published_at: string | null;
    scheduled_at?: string | null;
  }
) {
  return resolvePrimaryDateTimestamp(b) - resolvePrimaryDateTimestamp(a);
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

function normalizeStatusFilter(input: string | string[] | undefined): BlogStatusFilter {
  const value = Array.isArray(input) ? input[0] : input;
  if (value === 'all' || value === 'draft' || value === 'scheduled' || value === 'archived' || value === 'published') return value;
  return 'all';
}

function normalizePageNumber(input: string | string[] | undefined) {
  const value = Number(Array.isArray(input) ? input[0] : input);
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value));
}

function makePageHref(status: BlogStatusFilter, page: number) {
  const statusParam = status === 'all' ? '' : `status=${status}`;
  if (page <= 1) {
    return statusParam ? `/admin/blog?${statusParam}` : '/admin/blog';
  }
  return statusParam ? `/admin/blog?${statusParam}&page=${page}` : `/admin/blog?page=${page}`;
}

export default async function AdminBlogPage({
  searchParams
}: {
  searchParams?: { status?: string | string[]; page?: string | string[] };
}) {
  noStore();

  const activeStatus = normalizeStatusFilter(searchParams?.status);
  const listStatus = activeStatus === 'all' ? undefined : activeStatus;
  const activePage = normalizePageNumber(searchParams?.page);

  let posts: Awaited<ReturnType<typeof listBlogPostsAdmin>>['items'] = [];
  let pagination: Awaited<ReturnType<typeof listBlogPostsAdmin>>['pagination'] = {
    page: activePage,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 1
  };
  let loadError = '';

  try {
    const result = await listBlogPostsAdmin({
      status: listStatus,
      page: activePage,
      pageSize: PAGE_SIZE,
      sort: 'published'
    });
    posts = [...result.items].sort(byPrimaryDateDescending);
    pagination = result.pagination;
  } catch (error) {
    loadError = error instanceof Error ? error.message : 'Failed to load blog posts.';
  }

  const previousPage = Math.max(1, pagination.page - 1);
  const nextPage = Math.min(pagination.totalPages, pagination.page + 1);
  const hasPreviousPage = pagination.page > 1;
  const hasNextPage = pagination.page < pagination.totalPages;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
          <h1 className="text-4xl font-black">Compendium Blog</h1>
          <span className="rounded-full bg-carnival-red px-3 py-1 text-sm font-bold text-white">
            {pagination.total}
          </span>
      </div>

      <div className="flex justify-end gap-2">
        <Link href="/admin/blog/import" className="btn-secondary !bg-[#32466f] hover:!bg-[#2a3b5f]">
          Import
        </Link>
        <CreatePostButton
          label="+ New Post"
          className="btn-secondary"
        />
      </div>

      {loadError ? (
        <div className="rounded-xl border border-[#efb3b3] bg-[#fff2f2] px-4 py-3 text-sm font-semibold text-[#8d1010]">
          {loadError}
        </div>
      ) : null}

      <section className="card space-y-3 overflow-visible">
        <div className="flex justify-start">
          <AdminBlogStatusFilter value={activeStatus} />
        </div>

        {loadError ? (
          <p className="rounded-lg border border-carnival-ink/15 px-4 py-6 text-sm text-carnival-ink/70">
            Unable to load posts.
          </p>
        ) : posts.length ? (
          <ul className="space-y-3">
            {posts.map((post) => (
              <li key={post.id} className="rounded-xl border border-carnival-ink/10 bg-white/70 p-4">
                <div className="min-w-0 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <StatusPill status={post.status} />
                    {post.is_featured ? <span className="text-[0.95rem] text-[#b38a1f]" aria-label="Featured">★</span> : null}
                  </div>
                  <p className="flex items-center gap-1.5 text-[1.05rem] font-semibold leading-tight text-[#24313c]">
                    <span>{post.title}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2.5 text-xs text-black/48">
                    <span>Updated {formatUpdatedDate(post.updated_at)}</span>
                    {post.taxonomies?.categories?.[0] ? <span>{post.taxonomies.categories[0].name}</span> : null}
                  </div>
                  <div className="flex items-center justify-between gap-2.5 text-sm font-semibold text-[#24313c]">
                    <span>{formatPublishDate(post)}</span>
                    <div className="shrink-0">
                      <AdminBlogListActions postId={post.id} slug={post.slug} status={post.status} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-carnival-ink/15 px-4 py-6 text-sm text-carnival-ink/70">
            {activeStatus === 'all' ? 'No posts found.' : `No ${activeStatus} posts.`}
          </p>
        )}

        {pagination.totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-carnival-ink/10 pt-3 text-sm">
            <Link
              href={makePageHref(activeStatus, previousPage)}
              aria-disabled={!hasPreviousPage}
              className={`btn-secondary ${!hasPreviousPage ? 'pointer-events-none opacity-50' : ''}`}
              prefetch={false}
            >
              Previous
            </Link>
            <span className="text-carnival-ink/75">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <Link
              href={makePageHref(activeStatus, nextPage)}
              aria-disabled={!hasNextPage}
              className={`btn-secondary ${!hasNextPage ? 'pointer-events-none opacity-50' : ''}`}
              prefetch={false}
            >
              Next
            </Link>
          </div>
        ) : null}
      </section>
    </section>
  );
}
