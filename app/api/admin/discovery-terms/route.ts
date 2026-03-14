import { NextRequest } from 'next/server';
import { z } from 'zod';
import { badRequest, ok } from '@/lib/server';
import { requireAdminInApi } from '@/lib/api-auth';
import { createSupabaseAdminClient } from '@/lib/supabase';

const discoveryKindSchema = z.enum(['topic', 'theme', 'entity', 'case', 'event', 'collection', 'series']);

const createSchema = z.object({
  term_type: discoveryKindSchema,
  name: z.string().min(1).max(120),
  slug: z.string().min(1).max(160),
  description: z.string().max(2000).optional().default('')
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

export async function GET(_req: NextRequest) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('discovery_terms')
    .select('id,name,slug,description,term_type,entity_subtype,sort_order,is_featured,is_active,created_at,updated_at')
    .order('term_type', { ascending: true })
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) return badRequest(error.message);
  return ok({ items: data || [] });
}

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminInApi();
  if (!adminUser) return badRequest('Forbidden.', 403);

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Invalid taxonomy payload.');

  const slug = toSlug(parsed.data.slug || parsed.data.name);
  if (!slug) return badRequest('Slug is required.');

  const payload = {
    term_type: parsed.data.term_type,
    name: parsed.data.name.trim(),
    slug,
    description: parsed.data.description?.trim() || '',
    is_active: true
  };

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('discovery_terms')
    .insert(payload)
    .select('id,name,slug,description,term_type,entity_subtype,sort_order,is_featured,is_active,created_at,updated_at')
    .single();

  if (error) return badRequest(error.message);
  return ok({ item: data }, 201);
}
