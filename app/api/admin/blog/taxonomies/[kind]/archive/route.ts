import { NextRequest } from 'next/server';
import { z } from 'zod';
import { badRequest, ok } from '@/lib/server';
import { requireBlogAdminApiUser } from '@/lib/blog/auth';
import {
  archiveTaxonomy,
  getInternalArchiveableTaxonomyLegacyUrlPath,
  getTaxonomyArchiveImpact,
  listArchiveTargets,
  listBlogAuthors,
  listTaxonomy,
  type TaxonomyKind
} from '@/lib/blog/data';

type ArchiveableKind = TaxonomyKind | 'blog_authors';

const archiveInputSchema = z.object({
  taxonomyId: z.string().uuid(),
  mode: z.enum(['redirect_301', 'merge_redirect_301', 'gone_410']),
  redirectTarget: z.string().optional().nullable(),
  mergeTargetId: z.string().uuid().optional().nullable()
});

function toKind(value: string): ArchiveableKind | null {
  const supported: ArchiveableKind[] = ['categories', 'tags', 'series', 'topic_clusters', 'blog_authors'];
  return supported.includes(value as ArchiveableKind) ? (value as ArchiveableKind) : null;
}

function formatArchiveSchemaError(error: unknown) {
  const message = `${(error as { message?: string })?.message || ''}`;
  const lower = message.toLowerCase();
  if (lower.includes('column') && lower.includes('is_active') && lower.includes('does not exist')) {
    return 'Archive columns are missing in the database. Run migration 0025_taxonomy_archive_and_redirect_410.sql, then retry.';
  }
  if (lower.includes('column') && lower.includes('archive_mode') && lower.includes('does not exist')) {
    return 'Archive columns are missing in the database. Run migration 0025_taxonomy_archive_and_redirect_410.sql, then retry.';
  }
  if (lower.includes('column') && lower.includes('archived_at') && lower.includes('does not exist')) {
    return 'Archive columns are missing in the database. Run migration 0025_taxonomy_archive_and_redirect_410.sql, then retry.';
  }
  return null;
}

async function listRedirectSuggestions(kind: ArchiveableKind, currentId: string) {
  if (kind === 'blog_authors') {
    const authors = await listBlogAuthors();
    return authors
      .filter((item) => item.id !== currentId)
      .map((item) => ({
        id: item.id,
        name: item.name,
        path: getInternalArchiveableTaxonomyLegacyUrlPath('blog_authors', item.slug)
      }));
  }
  const items = await listTaxonomy(kind, { includeArchived: false });
  return items
    .filter((item) => item.id !== currentId)
    .map((item) => ({
      id: item.id,
      name: item.name,
      path: getInternalArchiveableTaxonomyLegacyUrlPath(kind, item.slug)
    }));
}

export async function GET(req: NextRequest, { params }: { params: { kind: string } }) {
  const user = await requireBlogAdminApiUser();
  if (!user) return badRequest('Unauthorized.', 401);
  const kind = toKind(params.kind);
  if (!kind) return badRequest('Unsupported taxonomy.', 404);
  const id = req.nextUrl.searchParams.get('id') || '';
  if (!id) return badRequest('Missing id.');

  try {
    const [impact, mergeTargets, redirectSuggestions] = await Promise.all([
      getTaxonomyArchiveImpact(kind, id),
      listArchiveTargets(kind, id),
      listRedirectSuggestions(kind, id)
    ]);
    return ok({
      impact,
      mergeTargets,
      redirectSuggestions
    });
  } catch (error: any) {
    const schemaError = formatArchiveSchemaError(error);
    return badRequest(schemaError || error?.message || 'Failed to load archive details.', 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: { kind: string } }) {
  const user = await requireBlogAdminApiUser();
  if (!user) return badRequest('Unauthorized.', 401);
  const kind = toKind(params.kind);
  if (!kind) return badRequest('Unsupported taxonomy.', 404);

  const parsed = archiveInputSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Invalid archive payload.');

  try {
    const result = await archiveTaxonomy({
      kind,
      taxonomyId: parsed.data.taxonomyId,
      mode: parsed.data.mode,
      redirectTarget: parsed.data.redirectTarget || null,
      mergeTargetId: parsed.data.mergeTargetId || null,
      actorId: `${user.id || ''}`,
      actorEmail: `${user.email || ''}`,
      allowAuthorMerge: false
    });
    return ok(result);
  } catch (error: any) {
    const schemaError = formatArchiveSchemaError(error);
    return badRequest(schemaError || error?.message || 'Failed to archive taxonomy.', 500);
  }
}
