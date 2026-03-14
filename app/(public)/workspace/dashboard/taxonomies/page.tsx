import { unstable_noStore as noStore } from 'next/cache';
import { WorkspaceTaxonomiesTable } from '@/components/workspace/workspace-taxonomies-table';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { NewTaxonomyButton } from './new-taxonomy-button';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type WorkspaceTaxonomyKind = 'topic' | 'theme' | 'entity' | 'case' | 'event' | 'collection' | 'series';

type WorkspaceTaxonomyRow = {
  id: string;
  kind: WorkspaceTaxonomyKind;
  entity_subtype: string | null;
  name: string;
  slug: string;
  description: string;
  blog_count: number;
  episode_count: number;
  sort_order: number | null;
  is_featured: boolean;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

function toRows(
  items: any[],
  blogCounts: Map<string, number>,
  episodeCounts: Map<string, number>
): WorkspaceTaxonomyRow[] {
  return (items || []).map((item) => ({
    id: item.id,
    kind: item.term_type as WorkspaceTaxonomyKind,
    entity_subtype: item.entity_subtype || null,
    name: item.name || '',
    slug: item.slug || '',
    description: item.description || '',
    blog_count: blogCounts.get(item.id) || 0,
    episode_count: episodeCounts.get(item.id) || 0,
    sort_order: typeof item.sort_order === 'number' ? item.sort_order : null,
    is_featured: item.is_featured === true,
    is_active: item.is_active !== false,
    created_at: item.created_at || null,
    updated_at: item.updated_at || null
  }));
}

export default async function WorkspaceTaxonomiesPage() {
  noStore();

  let rows: WorkspaceTaxonomyRow[] = [];
  let loadError = '';

  try {
    const supabase = createSupabaseAdminClient();
    const [termsQuery, blogLinksQuery, episodeLinksQuery] = await Promise.all([
      supabase
        .from('discovery_terms')
        .select('id,name,slug,description,term_type,entity_subtype,sort_order,is_featured,is_active,created_at,updated_at')
        .order('term_type', { ascending: true })
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('blog_post_discovery_terms')
        .select('term_id'),
      supabase
        .from('episode_discovery_terms')
        .select('term_id')
    ]);

    if (termsQuery.error) throw termsQuery.error;
    if (blogLinksQuery.error) throw blogLinksQuery.error;
    if (episodeLinksQuery.error) throw episodeLinksQuery.error;

    const blogCounts = new Map<string, number>();
    (blogLinksQuery.data || []).forEach((row: { term_id: string }) => {
      blogCounts.set(row.term_id, (blogCounts.get(row.term_id) || 0) + 1);
    });

    const episodeCounts = new Map<string, number>();
    (episodeLinksQuery.data || []).forEach((row: { term_id: string }) => {
      episodeCounts.set(row.term_id, (episodeCounts.get(row.term_id) || 0) + 1);
    });

    rows = toRows(termsQuery.data || [], blogCounts, episodeCounts);
  } catch (error) {
    loadError = 'Could not load taxonomies right now.';
    console.error('Workspace taxonomies failed to load:', error);
  }

  return (
    <section className="space-y-4">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">Taxonomies</h1>
          <p className="text-sm text-slate-600">All taxonomy terms mirrored from the existing admin taxonomy data.</p>
        </div>
        <NewTaxonomyButton />
      </header>

      {loadError ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</p>
      ) : null}

      <WorkspaceTaxonomiesTable rows={rows} />
    </section>
  );
}
