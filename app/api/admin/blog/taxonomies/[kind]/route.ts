import { NextRequest } from 'next/server';
import { badRequest, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import {
  deleteBlogAuthor,
  deleteTaxonomy,
  listBlogAuthors,
  listTaxonomy,
  saveBlogAuthor,
  upsertTaxonomy,
  type TaxonomyKind
} from '@/lib/blog/data';

export const dynamic = 'force-dynamic';

type TaxonomyRouteKind = TaxonomyKind | 'blog_authors';
type ArchiveableTaxonomyRouteKind = TaxonomyKind | 'blog_authors';

const ARCHIVEABLE_KINDS: ArchiveableTaxonomyRouteKind[] = ['categories', 'tags', 'series', 'topic_clusters', 'blog_authors'];

function toKind(value: string): TaxonomyRouteKind | null {
  const supported: TaxonomyRouteKind[] = ['categories', 'tags', 'series', 'topic_clusters', 'post_labels', 'blog_authors'];
  return supported.includes(value as TaxonomyRouteKind) ? (value as TaxonomyRouteKind) : null;
}

function toSingularLabel(kind: TaxonomyRouteKind) {
  if (kind === 'categories') return 'category';
  if (kind === 'tags') return 'tag';
  if (kind === 'series') return 'series';
  if (kind === 'topic_clusters') return 'topic cluster';
  if (kind === 'post_labels') return 'post label';
  return 'author';
}

export async function GET(_req: NextRequest, { params }: { params: { kind: string } }) {
  const user = await requireBlogAdminApiUser();
  if (!user) return badRequest('Unauthorized.', 401);
  const kind = toKind(params.kind);
  if (!kind) return badRequest('Unsupported taxonomy.', 404);
  try {
    if (kind === 'blog_authors') {
      return ok({ items: await listBlogAuthors({ includeArchived: true }) });
    }
    return ok({ items: await listTaxonomy(kind, { includeArchived: true }) });
  } catch (error: any) {
    return badRequest(error?.message || 'Failed to load taxonomy items.', 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: { kind: string } }) {
  const user = await requireBlogAdminApiUser();
  if (!user) return badRequest('Unauthorized.', 401);
  const kind = toKind(params.kind);
  if (!kind) return badRequest('Unsupported taxonomy.', 404);
  try {
    const payload = await req.json();
    const item = kind === 'blog_authors' ? await saveBlogAuthor(payload) : await upsertTaxonomy(kind, payload);
    return ok(item);
  } catch (error: any) {
    if (error?.code === '23505') {
      return badRequest(`A ${toSingularLabel(kind)} with this slug already exists.`, 409);
    }
    return badRequest(error?.message || 'Failed to save taxonomy item.', 500);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { kind: string } }) {
  const user = await requireBlogAdminApiUser();
  if (!user) return badRequest('Unauthorized.', 401);
  const kind = toKind(params.kind);
  if (!kind) return badRequest('Unsupported taxonomy.', 404);
  if (ARCHIVEABLE_KINDS.includes(kind as ArchiveableTaxonomyRouteKind)) {
    return badRequest('This taxonomy kind uses archive-only workflow. Use the archive endpoint.', 405);
  }
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) return badRequest('Missing id.');
  try {
    if (kind === 'blog_authors') {
      await deleteBlogAuthor(id);
    } else {
      await deleteTaxonomy(kind, id);
    }
    return ok({ message: 'Deleted.' });
  } catch (error: any) {
    return badRequest(error?.message || 'Failed to delete taxonomy item.', 500);
  }
}
