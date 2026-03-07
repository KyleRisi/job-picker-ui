'use client';

import { useEffect, useMemo, useState } from 'react';

type TabKey = 'categories' | 'tags' | 'series' | 'topic_clusters' | 'post_labels' | 'blog_authors';
const TAXONOMY_TAB_STORAGE_KEY = 'blog_admin_taxonomy_tab';

const LABELS: Record<TabKey, string> = {
  categories: 'Categories',
  tags: 'Tags',
  series: 'Series',
  topic_clusters: 'Topic clusters',
  post_labels: 'Post labels',
  blog_authors: 'Authors'
};

const SINGULAR_LABELS: Record<TabKey, string> = {
  categories: 'Category',
  tags: 'Tag',
  series: 'Series',
  topic_clusters: 'Topic cluster',
  post_labels: 'Post label',
  blog_authors: 'Author'
};

const EMPTY_FORM = { name: '', slug: '', description: '' };
type TaxonomyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  bio?: string;
};

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

function isTabKey(value: string | null): value is TabKey {
  return value === 'categories'
    || value === 'tags'
    || value === 'series'
    || value === 'topic_clusters'
    || value === 'post_labels'
    || value === 'blog_authors';
}

export function AdminTaxonomiesManager({ initialData }: { initialData: Record<TabKey, any[]> }) {
  const [tab, setTab] = useState<TabKey>('categories');
  const [data, setData] = useState<Record<TabKey, TaxonomyRow[]>>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [formValues, setFormValues] = useState(EMPTY_FORM);
  const items = useMemo(() => data[tab] || [], [data, tab]);

  useEffect(() => {
    setEditingId(null);
    setSlugManuallyEdited(false);
    setFormValues(EMPTY_FORM);
    setIsSaving(false);
  }, [tab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(TAXONOMY_TAB_STORAGE_KEY);
      if (isTabKey(stored)) {
        setTab(stored);
      }
    } catch {
      // Ignore storage read failures in constrained browser contexts.
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(TAXONOMY_TAB_STORAGE_KEY, tab);
    } catch {
      // Ignore storage write failures in constrained browser contexts.
    }
  }, [tab]);

  async function requestJson(url: string, init?: RequestInit, fallbackError = 'Request failed.') {
    try {
      const response = await fetch(url, {
        cache: 'no-store',
        ...init
      });
      const data = await response.json().catch(() => ({}));
      return {
        ok: response.ok,
        status: response.status,
        data,
        error: response.ok ? null : data?.error || fallbackError
      };
    } catch {
      return {
        ok: false,
        status: 0,
        data: null,
        error: 'Network error. Please try again.'
      };
    }
  }

  function upsertLocal(kind: TabKey, item: TaxonomyRow) {
    setData((current) => {
      const existing = current[kind] || [];
      const without = existing.filter((row) => row.id !== item.id);
      return {
        ...current,
        [kind]: [item, ...without].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
      };
    });
  }

  function removeLocal(kind: TabKey, id: string) {
    setData((current) => ({
      ...current,
      [kind]: (current[kind] || []).filter((item) => item.id !== id)
    }));
  }

  async function reload(kind: TabKey) {
    const result = await requestJson(`/api/admin/blog/taxonomies/${kind}`, undefined, 'Failed to load taxonomy items.');
    if (!result.ok) {
      window.alert(result.error || 'Failed to load taxonomy items.');
      return;
    }
    setData((current) => ({ ...current, [kind]: result.data?.items || [] }));
  }

  function startEditing(item: TaxonomyRow) {
    setEditingId(item.id);
    setSlugManuallyEdited(true);
    setFormValues({
      name: item.name || '',
      slug: item.slug || '',
      description: item.description || item.bio || ''
    });
  }

  function resetForm() {
    setEditingId(null);
    setSlugManuallyEdited(false);
    setFormValues(EMPTY_FORM);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(LABELS) as TabKey[]).map((key) => (
          <button key={key} type="button" className={key === tab ? 'btn-primary' : 'btn-secondary'} onClick={() => setTab(key)}>
            {LABELS[key]}
          </button>
        ))}
      </div>

      <form
        className="card grid gap-3 md:grid-cols-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (isSaving) return;
          setIsSaving(true);
          try {
            const formData = new FormData(event.currentTarget);
            const rawSlug = `${formData.get('slug') || ''}`.trim();
            const normalizedSlug = toSlug(rawSlug.replace(/^\/+/, ''));
            const normalizedName = `${formData.get('name') || ''}`.trim();
            const payload = {
              ...(editingId ? { id: editingId } : {}),
              name: normalizedName,
              slug: normalizedSlug || toSlug(normalizedName),
              description: `${formData.get('description') || ''}`,
              bio: `${formData.get('description') || ''}`
            };
            const result = await requestJson(`/api/admin/blog/taxonomies/${tab}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            }, `Failed to ${editingId ? 'update' : 'create'} item.`);
            if (!result.ok) {
              window.alert(result.error || `Failed to ${editingId ? 'update' : 'create'} item.`);
              if (result.status === 409) await reload(tab);
              return;
            }
            const saved = result.data as TaxonomyRow;
            if (saved?.id) upsertLocal(tab, saved);
            resetForm();
          } catch {
            window.alert(`Failed to ${editingId ? 'update' : 'create'} item.`);
          } finally {
            setIsSaving(false);
          }
        }}
      >
        {editingId ? <p className="md:col-span-4 text-sm font-semibold text-carnival-ink/75">Editing {SINGULAR_LABELS[tab]}</p> : null}
        <input
          className="input"
          name="name"
          placeholder={`${LABELS[tab]} name`}
          required
          value={formValues.name}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setFormValues((current) => ({
              ...current,
              name: value,
              ...(!editingId && !slugManuallyEdited ? { slug: toSlug(value) } : {})
            }));
          }}
        />
        <input
          className="input"
          name="slug"
          placeholder="slug (e.g. true-crime)"
          required
          value={formValues.slug}
          onChange={(event) => {
            const value = event.currentTarget.value;
            const slug = toSlug(value.replace(/^\/+/, ''));
            setFormValues((current) => ({ ...current, slug }));
            if (!editingId) {
              setSlugManuallyEdited(true);
            }
          }}
        />
        <input
          className="input md:col-span-2"
          name="description"
          placeholder={tab === 'blog_authors' ? 'Bio' : 'Description'}
          value={formValues.description}
          onChange={(event) => {
            const value = event.currentTarget.value;
            setFormValues((current) => ({ ...current, description: value }));
          }}
        />
        <button className="btn-primary md:col-span-4 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : editingId ? `Update ${SINGULAR_LABELS[tab]}` : `Create ${SINGULAR_LABELS[tab]}`}
        </button>
        {editingId ? (
          <button type="button" className="btn-secondary md:col-span-4" onClick={resetForm} disabled={isSaving}>
            Cancel edit
          </button>
        ) : null}
      </form>

      <div className="overflow-auto rounded-2xl border-2 border-carnival-ink/15 bg-white shadow-card">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-carnival-gold/25">
            <tr>
              <th className="px-4 py-3 font-black">Name</th>
              <th className="px-4 py-3 font-black">Slug</th>
              <th className="px-4 py-3 font-black">Description</th>
              <th className="px-4 py-3 font-black">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-carnival-ink/10 last:border-0">
                <td className="px-4 py-3 font-semibold">{item.name}</td>
                <td className="px-4 py-3">{item.slug}</td>
                <td className="px-4 py-3">{item.description || item.bio || ''}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-secondary !px-3 !py-1 text-sm" onClick={() => startEditing(item)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn-secondary !px-3 !py-1 text-sm"
                      onClick={async () => {
                        const confirmed = window.confirm(`Delete "${item.name}"? This cannot be undone.`);
                        if (!confirmed) return;
                        const result = await requestJson(`/api/admin/blog/taxonomies/${tab}?id=${item.id}`, { method: 'DELETE' }, 'Failed to delete item.');
                        if (!result.ok) {
                          window.alert(result.error || 'Failed to delete item.');
                          return;
                        }
                        if (editingId === item.id) {
                          resetForm();
                        }
                        removeLocal(tab, item.id);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
