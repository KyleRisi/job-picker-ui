'use client';

import { useEffect, useMemo, useState } from 'react';

type TabKey = 'categories' | 'tags' | 'series' | 'topic_clusters' | 'post_labels' | 'blog_authors';
type ArchiveMode = 'redirect_301' | 'merge_redirect_301' | 'gone_410';

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
const ARCHIVEABLE_KINDS: TabKey[] = ['categories', 'tags', 'series', 'topic_clusters', 'blog_authors'];

type TaxonomyRow = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  bio?: string;
  is_active?: boolean;
  archived_at?: string | null;
  archive_mode?: string | null;
  redirect_target?: string | null;
};

type ArchiveDetails = {
  impact: { assignedContentCount: number; internalReferenceCount: number | null };
  mergeTargets: Array<{ id: string; name: string; slug: string }>;
  redirectSuggestions: Array<{ id: string; name: string; path: string }>;
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

function isArchiveable(kind: TabKey) {
  return ARCHIVEABLE_KINDS.includes(kind);
}

function taxonomyPath(kind: TabKey, slug: string) {
  if (kind === 'categories') return `/topics/${slug}`;
  if (kind === 'tags') return '/blog';
  if (kind === 'series') return `/collections/${slug}`;
  if (kind === 'topic_clusters') return `/topics/${slug}`;
  if (kind === 'blog_authors') return `/blog/author/${slug}`;
  return `/blog`;
}

function formatArchiveDate(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function normalizeForComparison(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('/')) return trimmed;
  const compact = trimmed.replace(/\/+/g, '/');
  if (compact === '/') return '/';
  return compact.replace(/\/+$/, '');
}

export function AdminTaxonomiesManager({ initialData }: { initialData: Record<TabKey, any[]> }) {
  const [tab, setTab] = useState<TabKey>('categories');
  const [data, setData] = useState<Record<TabKey, TaxonomyRow[]>>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [formValues, setFormValues] = useState(EMPTY_FORM);

  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveRow, setArchiveRow] = useState<TaxonomyRow | null>(null);
  const [archiveMode, setArchiveMode] = useState<ArchiveMode>('redirect_301');
  const [archiveDetails, setArchiveDetails] = useState<ArchiveDetails | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [archiveError, setArchiveError] = useState('');
  const [archiveWarningAck, setArchiveWarningAck] = useState(false);
  const [redirectType, setRedirectType] = useState<'suggested' | 'custom'>('suggested');
  const [selectedRedirectPath, setSelectedRedirectPath] = useState('');
  const [customRedirectPath, setCustomRedirectPath] = useState('');
  const [selectedMergeId, setSelectedMergeId] = useState('');

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
      const responseData = await response.json().catch(() => ({}));
      return {
        ok: response.ok,
        status: response.status,
        data: responseData,
        error: response.ok ? null : responseData?.error || fallbackError
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

  async function openArchiveModal(item: TaxonomyRow) {
    setArchiveOpen(true);
    setArchiveRow(item);
    setArchiveMode('redirect_301');
    setArchiveWarningAck(false);
    setArchiveError('');
    setArchiveDetails(null);
    setArchiveLoading(true);
    setRedirectType('suggested');
    setSelectedRedirectPath('');
    setCustomRedirectPath('');
    setSelectedMergeId('');

    const result = await requestJson(`/api/admin/blog/taxonomies/${tab}/archive?id=${item.id}`, undefined, 'Failed to load archive details.');
    setArchiveLoading(false);
    if (!result.ok) {
      setArchiveError(result.error || 'Failed to load archive details.');
      return;
    }

    const details = result.data as ArchiveDetails;
    setArchiveDetails(details);
    const firstPath = details.redirectSuggestions?.[0]?.path || '/blog';
    setSelectedRedirectPath(firstPath);
  }

  function closeArchiveModal() {
    setArchiveOpen(false);
    setArchiveRow(null);
    setArchiveMode('redirect_301');
    setArchiveWarningAck(false);
    setArchiveError('');
    setArchiveDetails(null);
    setArchiveLoading(false);
    setArchiveSaving(false);
    setRedirectType('suggested');
    setSelectedRedirectPath('');
    setCustomRedirectPath('');
    setSelectedMergeId('');
  }

  const archiveSourcePath = archiveRow ? taxonomyPath(tab, archiveRow.slug) : '';
  const resolvedRedirectTarget = archiveMode !== 'redirect_301'
    ? ''
    : redirectType === 'custom'
      ? customRedirectPath.trim()
      : selectedRedirectPath.trim();

  const archiveValidationError = useMemo(() => {
    if (!archiveRow) return '';
    if (archiveMode === 'redirect_301') {
      if (!resolvedRedirectTarget) return 'Choose a redirect destination.';
      const source = normalizeForComparison(archiveSourcePath);
      const destination = normalizeForComparison(resolvedRedirectTarget);
      if (source && destination && source === destination) return 'Redirect destination cannot be the same as the current URL.';
      return '';
    }
    if (archiveMode === 'merge_redirect_301') {
      if (tab === 'blog_authors') return 'Author merge is currently disabled for attribution safety.';
      if (!selectedMergeId) return 'Select a merge target.';
      if (selectedMergeId === archiveRow.id) return 'Cannot merge into the same taxonomy.';
      return '';
    }
    if (!archiveWarningAck) return 'Please acknowledge the 410 warning.';
    return '';
  }, [archiveMode, archiveRow, archiveSourcePath, archiveWarningAck, resolvedRedirectTarget, selectedMergeId, tab]);

  const archiveSummary = useMemo(() => {
    if (!archiveRow) return '';
    if (archiveMode === 'redirect_301') {
      const destination = resolvedRedirectTarget || '[choose destination]';
      return `This will archive ${archiveSourcePath}, create a permanent 301 redirect to ${destination}, and remove this taxonomy from public listings.`;
    }
    if (archiveMode === 'merge_redirect_301') {
      const mergeTarget = archiveDetails?.mergeTargets?.find((target) => target.id === selectedMergeId);
      const destination = mergeTarget ? taxonomyPath(tab, mergeTarget.slug) : '[choose merge target]';
      const count = archiveDetails?.impact?.assignedContentCount ?? 0;
      return `This will archive ${archiveSourcePath}, move ${count} content item${count === 1 ? '' : 's'} to ${destination}, and create a permanent 301 redirect.`;
    }
    return `This will archive ${archiveSourcePath} and return 410 Gone for that URL.`;
  }, [archiveDetails?.impact?.assignedContentCount, archiveDetails?.mergeTargets, archiveMode, archiveRow, archiveSourcePath, resolvedRedirectTarget, selectedMergeId, tab]);

  const selectedMergeTarget = useMemo(
    () => archiveDetails?.mergeTargets?.find((target) => target.id === selectedMergeId) || null,
    [archiveDetails?.mergeTargets, selectedMergeId]
  );

  async function submitArchive() {
    if (!archiveRow || archiveValidationError) return;
    setArchiveSaving(true);
    setArchiveError('');

    const payload: Record<string, unknown> = {
      taxonomyId: archiveRow.id,
      mode: archiveMode
    };
    if (archiveMode === 'redirect_301') {
      payload.redirectTarget = resolvedRedirectTarget;
    }
    if (archiveMode === 'merge_redirect_301') {
      payload.mergeTargetId = selectedMergeId;
    }

    const result = await requestJson(`/api/admin/blog/taxonomies/${tab}/archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 'Failed to archive taxonomy.');

    setArchiveSaving(false);
    if (!result.ok) {
      setArchiveError(result.error || 'Failed to archive taxonomy.');
      return;
    }

    await reload(tab);
    closeArchiveModal();
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
              <th className="px-4 py-3 font-black">Status</th>
              <th className="px-4 py-3 font-black">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const isArchived = item.is_active === false;
              const is410 = item.archive_mode === 'gone_410';
              const metadata = [
                item.archived_at ? `Archived ${formatArchiveDate(item.archived_at)}` : '',
                item.archive_mode ? `Mode: ${item.archive_mode}` : '',
                item.redirect_target ? `Target: ${item.redirect_target}` : ''
              ].filter(Boolean).join(' • ');
              return (
                <tr key={item.id} className={`border-b border-carnival-ink/10 last:border-0 ${isArchived ? 'bg-slate-50' : ''}`}>
                  <td className="px-4 py-3 font-semibold">{item.name}</td>
                  <td className="px-4 py-3">{item.slug}</td>
                  <td className="px-4 py-3">{item.description || item.bio || ''}</td>
                  <td className="px-4 py-3">
                    {!isArchived ? (
                      <span className="inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">Active</span>
                    ) : (
                      <span title={metadata} className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${is410 ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800'}`}>
                        {is410 ? 'Archived • 410 Gone' : `Archived • 301 to ${item.redirect_target || 'destination'}`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary !px-3 !py-1 text-sm" onClick={() => startEditing(item)}>
                        Edit
                      </button>
                      {isArchiveable(tab) ? (
                        <button
                          type="button"
                          className="btn-secondary !px-3 !py-1 text-sm"
                          disabled={isArchived}
                          onClick={() => {
                            void openArchiveModal(item);
                          }}
                        >
                          Archive
                        </button>
                      ) : (
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
                            if (editingId === item.id) resetForm();
                            removeLocal(tab, item.id);
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {archiveOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={closeArchiveModal}>
          <div className="w-full max-w-3xl rounded-2xl border border-carnival-ink/20 bg-white p-5 shadow-card" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xl font-black">Archive Taxonomy</h3>
              <button type="button" className="btn-secondary !px-3 !py-1 text-sm" onClick={closeArchiveModal}>Close</button>
            </div>

            {archiveRow ? (
              <div className="space-y-4">
                <p className="text-sm text-carnival-ink/80">
                  This taxonomy currently exists at:
                  <span className="ml-1 font-semibold">{archiveSourcePath}</span>
                </p>
                <p className="text-sm text-carnival-ink/75">
                  Archiving a taxonomy without handling its URL can create broken links and harm SEO. Choose what should happen to this taxonomy when it is archived.
                </p>

                <div className="rounded-md border border-carnival-ink/15 bg-carnival-cream/30 p-3 text-sm">
                  <p className="font-semibold">Impact</p>
                  <p>Assigned content items: {archiveDetails?.impact?.assignedContentCount ?? 0}</p>
                  <p>Internal references: {archiveDetails?.impact?.internalReferenceCount ?? 'Coming soon'}</p>
                  <p>Current status: {archiveRow.is_active === false ? 'Archived' : 'Active'}</p>
                </div>

                <div className="space-y-3 rounded-md border border-carnival-ink/15 p-3">
                  <label className="flex items-start gap-2">
                    <input type="radio" checked={archiveMode === 'redirect_301'} onChange={() => setArchiveMode('redirect_301')} className="mt-1" />
                    <span>
                      <span className="font-semibold">301 redirect this taxonomy</span>
                    </span>
                  </label>

                  {archiveMode === 'redirect_301' ? (
                    <div className="ml-6 space-y-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" checked={redirectType === 'suggested'} onChange={() => setRedirectType('suggested')} />
                        Choose from active taxonomy destinations
                      </label>
                      {redirectType === 'suggested' ? (
                        <select
                          className="input"
                          value={selectedRedirectPath}
                          onChange={(event) => setSelectedRedirectPath(event.currentTarget.value)}
                        >
                          {archiveDetails?.redirectSuggestions?.map((item) => (
                            <option key={item.id} value={item.path}>
                              {item.name} ({item.path})
                            </option>
                          ))}
                          <option value="/blog">Blog hub (/blog)</option>
                        </select>
                      ) : null}

                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" checked={redirectType === 'custom'} onChange={() => setRedirectType('custom')} />
                        Use a custom URL
                      </label>
                      {redirectType === 'custom' ? (
                        <input
                          className="input"
                          placeholder="/blog or https://example.com/path"
                          value={customRedirectPath}
                          onChange={(event) => setCustomRedirectPath(event.currentTarget.value)}
                        />
                      ) : null}
                    </div>
                  ) : null}

                  <label className="flex items-start gap-2">
                    <input type="radio" checked={archiveMode === 'merge_redirect_301'} onChange={() => setArchiveMode('merge_redirect_301')} className="mt-1" />
                    <span>
                      <span className="font-semibold">Merge content into another taxonomy and redirect</span>
                    </span>
                  </label>
                  {archiveMode === 'merge_redirect_301' ? (
                    <div className="ml-6 space-y-2">
                      {tab === 'blog_authors' ? (
                        <p className="text-sm text-carnival-red">Author merge is disabled by default due attribution risk.</p>
                      ) : (
                        <select className="input" value={selectedMergeId} onChange={(event) => setSelectedMergeId(event.currentTarget.value)}>
                          <option value="">Select merge target</option>
                          {archiveDetails?.mergeTargets?.map((target) => (
                            <option key={target.id} value={target.id}>
                              {target.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : null}

                  <label className="flex items-start gap-2">
                    <input type="radio" checked={archiveMode === 'gone_410'} onChange={() => setArchiveMode('gone_410')} className="mt-1" />
                    <span>
                      <span className="font-semibold">Remove and return 410 Gone</span>
                      <p className="text-sm text-carnival-ink/70">Use this only if this taxonomy has no SEO value and should be permanently removed from search.</p>
                    </span>
                  </label>
                  {archiveMode === 'gone_410' ? (
                    <label className="ml-6 flex items-center gap-2 text-sm font-medium text-carnival-red">
                      <input type="checkbox" checked={archiveWarningAck} onChange={(event) => setArchiveWarningAck(event.currentTarget.checked)} />
                      I understand this URL will return 410 Gone.
                    </label>
                  ) : null}
                </div>

                <div className="rounded-md border border-carnival-ink/15 bg-carnival-cream/30 p-3 text-sm">
                  <p className="font-semibold">Summary</p>
                  <p>{archiveSummary}</p>
                </div>

                <div className="rounded-md border border-carnival-ink/15 bg-white p-3 text-sm">
                  <p className="font-semibold">Redirect preview</p>
                  <p>Current: <span className="font-medium">{archiveSourcePath}</span></p>
                  {archiveMode === 'gone_410' ? (
                    <p>This taxonomy URL will return <span className="font-medium">410 Gone</span> once archived.</p>
                  ) : (
                    <p>
                      301 redirects to:{' '}
                      <span className="font-medium">
                        {archiveMode === 'merge_redirect_301'
                          ? (selectedMergeTarget ? taxonomyPath(tab, selectedMergeTarget.slug) : '[choose merge target]')
                          : (resolvedRedirectTarget || '[choose destination]')}
                      </span>
                    </p>
                  )}
                </div>

                {archiveValidationError ? <p className="text-sm font-semibold text-carnival-red">{archiveValidationError}</p> : null}
                {archiveError ? <p className="rounded-md bg-red-100 p-2 text-sm font-semibold text-carnival-red">{archiveError}</p> : null}
                {archiveLoading ? <p className="text-sm text-carnival-ink/70">Loading impact details...</p> : null}

                <div className="flex items-center justify-end gap-2">
                  <button type="button" className="btn-secondary" onClick={closeArchiveModal}>Cancel</button>
                  <button
                    type="button"
                    className="btn-primary disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => {
                      void submitArchive();
                    }}
                    disabled={archiveSaving || archiveLoading || Boolean(archiveValidationError)}
                  >
                    {archiveSaving ? 'Archiving...' : 'Confirm Archive'}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
