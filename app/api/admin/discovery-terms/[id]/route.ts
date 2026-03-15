import { NextRequest } from 'next/server';
import { z } from 'zod';
import { badRequest, ok } from '@/lib/server';
import { requireAdminInApi } from '@/lib/api-auth';
import { createSupabaseAdminClient } from '@/lib/supabase';

const discoveryKindSchema = z.enum(['topic', 'theme', 'entity', 'case', 'event', 'collection', 'series']);

const updateSchema = z.object({
  term_type: discoveryKindSchema,
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(160),
  description: z.string().max(2000).optional().default(''),
  is_active: z.boolean().optional()
});

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Invalid taxonomy payload.');

  const slug = toSlug(parsed.data.slug || parsed.data.name);
  if (!slug) return badRequest('Slug is required.');

  const payload = {
    term_type: parsed.data.term_type,
    name: parsed.data.name.trim(),
    slug,
    description: parsed.data.description?.trim() || '',
    ...(typeof parsed.data.is_active === 'boolean' ? { is_active: parsed.data.is_active } : {})
  };

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('discovery_terms')
    .update(payload)
    .eq('id', params.id)
    .select('id,name,slug,description,term_type,entity_subtype,sort_order,is_featured,is_active,created_at,updated_at')
    .maybeSingle();

  if (error) return badRequest(error.message);
  if (!data) return badRequest('Taxonomy not found.', 404);
  return ok({ item: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('discovery_terms')
    .update({ is_active: false })
    .eq('id', params.id);

  if (error) return badRequest(error.message);
  const [episodeLinksDelete, postLinksDelete] = await Promise.all([
    supabase.from('episode_discovery_terms').delete().eq('term_id', params.id),
    supabase.from('blog_post_discovery_terms').delete().eq('term_id', params.id)
  ]);
  if (episodeLinksDelete.error) return badRequest(episodeLinksDelete.error.message);
  if (postLinksDelete.error) return badRequest(postLinksDelete.error.message);
  return ok({ message: 'Taxonomy archived.' });
}
