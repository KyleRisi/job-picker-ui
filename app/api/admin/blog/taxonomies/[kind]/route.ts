import { NextRequest } from 'next/server';
import { badRequest, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import { deleteTaxonomy, listTaxonomy, upsertTaxonomy, type TaxonomyKind } from '@/lib/blog/data';

export const dynamic = 'force-dynamic';

function toKind(value: string): TaxonomyKind | null {
  const supported: TaxonomyKind[] = ['categories', 'tags', 'series', 'topic_clusters', 'post_labels', 'blog_authors'];
  return supported.includes(value as TaxonomyKind) ? (value as TaxonomyKind) : null;
}

function toSingularLabel(kind: TaxonomyKind) {
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
    return ok({ items: await listTaxonomy(kind) });
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
    const item = await upsertTaxonomy(kind, payload);
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
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) return badRequest('Missing id.');
  try {
    await deleteTaxonomy(kind, id);
    return ok({ message: 'Deleted.' });
  } catch (error: any) {
    return badRequest(error?.message || 'Failed to delete taxonomy item.', 500);
  }
}
