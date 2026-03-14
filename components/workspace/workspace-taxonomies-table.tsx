'use client';

import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useState } from 'react';

type TaxonomyKind = 'topic' | 'theme' | 'entity' | 'case' | 'event' | 'collection' | 'series';

type WorkspaceTaxonomyRow = {
  id: string;
  kind: TaxonomyKind;
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

type ColumnKey =
  | 'id'
  | 'type'
  | 'subtype'
  | 'name'
  | 'slug'
  | 'description'
  | 'blog_count'
  | 'episode_count'
  | 'sort_order'
  | 'featured'
  | 'status'
  | 'created_at'
  | 'updated_at'
  | 'actions';
type ResizeState = { key: ColumnKey; startX: number; startWidth: number } | null;

type TaxonomyApiItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  term_type: TaxonomyKind;
  entity_subtype: string | null;
  blog_count?: number;
  episode_count?: number;
  sort_order: number | null;
  is_featured: boolean;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

const PAGE_SIZE = 50;
const TAXONOMY_COLUMN_WIDTHS_STORAGE_KEY = 'workspace_taxonomies_column_widths';
const TAXONOMY_VISIBLE_COLUMNS_STORAGE_KEY = 'workspace_taxonomies_visible_columns';
const TAXONOMY_ACTIONS_WIDTH_CUSTOMIZED_STORAGE_KEY = 'workspace_taxonomies_actions_width_customized';
const MIN_COLUMN_WIDTH = 120;
const MAX_COLUMN_WIDTH = 1200;
const ACTIONS_COLUMN_MIN_WIDTH = 132;
const ACTIONS_COLUMN_DEFAULT_WIDTH = 132;
const LEGACY_ACTIONS_COLUMN_DEFAULT_WIDTH = 180;
const LEGACY_ACTIONS_COLUMN_FALLBACK_WIDTH = 128;

const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  id: 260,
  type: 180,
  subtype: 180,
  name: 260,
  slug: 260,
  description: 520,
  blog_count: 160,
  episode_count: 180,
  sort_order: 140,
  featured: 140,
  status: 220,
  created_at: 180,
  updated_at: 180,
  actions: ACTIONS_COLUMN_DEFAULT_WIDTH
};

const ALL_COLUMNS: Array<{ key: ColumnKey; label: string }> = [
  { key: 'id', label: 'ID' },
  { key: 'type', label: 'Type' },
  { key: 'subtype', label: 'Subtype' },
  { key: 'name', label: 'Name' },
  { key: 'slug', label: 'Slug' },
  { key: 'description', label: 'Description' },
  { key: 'blog_count', label: 'Blogs Assigned' },
  { key: 'episode_count', label: 'Episodes Assigned' },
  { key: 'sort_order', label: 'Sort Order' },
  { key: 'featured', label: 'Featured' },
  { key: 'status', label: 'Status' },
  { key: 'created_at', label: 'Created' },
  { key: 'updated_at', label: 'Updated' },
  { key: 'actions', label: 'Actions' }
];

const FIXED_COLUMN: ColumnKey = 'actions';
const EDITABLE_COLUMNS: Array<{ key: Exclude<ColumnKey, 'actions'>; label: string }> = ALL_COLUMNS.filter(
  (column): column is { key: Exclude<ColumnKey, 'actions'>; label: string } => column.key !== FIXED_COLUMN
);
const DEFAULT_VISIBLE_COLUMNS: Array<Exclude<ColumnKey, 'actions'>> = EDITABLE_COLUMNS.map((column) => column.key);

const KIND_LABELS: Record<TaxonomyKind, string> = {
  topic: 'Topic',
  theme: 'Theme',
  entity: 'Entity',
  case: 'Case',
  event: 'Event',
  collection: 'Collection',
  series: 'Series'
};

const EMPTY_FORM = {
  kind: 'topic' as TaxonomyKind,
  name: '',
  slug: '',
  description: ''
};

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\'’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function toRow(item: TaxonomyApiItem): WorkspaceTaxonomyRow {
  return {
    id: item.id,
    kind: item.term_type,
    entity_subtype: item.entity_subtype || null,
    name: item.name || '',
    slug: item.slug || '',
    description: item.description || '',
    blog_count: typeof item.blog_count === 'number' ? item.blog_count : 0,
    episode_count: typeof item.episode_count === 'number' ? item.episode_count : 0,
    sort_order: typeof item.sort_order === 'number' ? item.sort_order : null,
    is_featured: item.is_featured === true,
    is_active: item.is_active !== false,
    created_at: item.created_at || null,
    updated_at: item.updated_at || null
  };
}

function formatShortDate(value: string | null | undefined) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('en-GB');
}

function getColumnMinWidth(column: ColumnKey) {
  return column === FIXED_COLUMN ? ACTIONS_COLUMN_MIN_WIDTH : MIN_COLUMN_WIDTH;
}

function clampColumnWidth(column: ColumnKey, value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(getColumnMinWidth(column), Math.min(MAX_COLUMN_WIDTH, Math.round(value)));
}

export function WorkspaceTaxonomiesTable({ rows }: { rows: WorkspaceTaxonomyRow[] }) {
  const [tableRows, setTableRows] = useState(rows);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | TaxonomyKind>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<WorkspaceTaxonomyRow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [reactivateOnSave, setReactivateOnSave] = useState(false);
  const [formValues, setFormValues] = useState(EMPTY_FORM);

  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(DEFAULT_COLUMN_WIDTHS);
  const [resizing, setResizing] = useState<ResizeState>(null);
  const [widthsRestored, setWidthsRestored] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Array<Exclude<ColumnKey, 'actions'>>>(DEFAULT_VISIBLE_COLUMNS);
  const [columnEditorOpen, setColumnEditorOpen] = useState(false);
  const [columnSearch, setColumnSearch] = useState('');
  const [draftColumns, setDraftColumns] = useState<Array<Exclude<ColumnKey, 'actions'>>>(DEFAULT_VISIBLE_COLUMNS);
  const [columnsRestored, setColumnsRestored] = useState(false);

  useEffect(() => {
    setTableRows(rows);
  }, [rows]);

  useEffect(() => {
    function onOpenCreateModal() {
      setEditingRow(null);
      setCreateOpen(true);
    }
    window.addEventListener('workspace-taxonomies:new', onOpenCreateModal);
    return () => window.removeEventListener('workspace-taxonomies:new', onOpenCreateModal);
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(TAXONOMY_VISIBLE_COLUMNS_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return;
      const valid = parsed.filter((key): key is Exclude<ColumnKey, 'actions'> => EDITABLE_COLUMNS.some((column) => column.key === key));
      if (!valid.length) return;
      setVisibleColumns(valid);
      setDraftColumns(valid);
    } catch {
      // Ignore storage parse failures.
    } finally {
      setColumnsRestored(true);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(TAXONOMY_COLUMN_WIDTHS_STORAGE_KEY);
      const actionsWidthCustomized = window.localStorage.getItem(TAXONOMY_ACTIONS_WIDTH_CUSTOMIZED_STORAGE_KEY) === '1';
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Record<ColumnKey, number>>;
        setColumnWidths((current) => ({
          ...current,
          ...Object.fromEntries(
            (Object.keys(DEFAULT_COLUMN_WIDTHS) as ColumnKey[]).map((key) => {
              const persisted = parsed[key];
              const raw =
                key === 'actions'
                  ? (
                    actionsWidthCustomized
                      ? Number(persisted ?? current[key])
                      : ACTIONS_COLUMN_DEFAULT_WIDTH
                  )
                  : Number(persisted ?? current[key]);
              const bounded = clampColumnWidth(key, raw, current[key]);
              const migrated =
                key === 'actions'
                  && (
                    Number(persisted) === LEGACY_ACTIONS_COLUMN_DEFAULT_WIDTH
                    || Number(persisted) === LEGACY_ACTIONS_COLUMN_FALLBACK_WIDTH
                  )
                  ? ACTIONS_COLUMN_DEFAULT_WIDTH
                  : bounded;
              return [key, migrated];
            })
          )
        }));
      }
    } catch {
      // Ignore local storage failures in restricted contexts.
    } finally {
      setWidthsRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!widthsRestored) return;
    try {
      window.localStorage.setItem(TAXONOMY_COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths));
    } catch {
      // Ignore local storage failures in restricted contexts.
    }
  }, [columnWidths, widthsRestored]);

  useEffect(() => {
    if (!columnsRestored) return;
    try {
      window.localStorage.setItem(TAXONOMY_VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns));
    } catch {
      // Ignore storage write failures in restricted contexts.
    }
  }, [columnsRestored, visibleColumns]);

  useEffect(() => {
    if (!resizing) return;
    const activeResize = resizing;

    function onMouseMove(event: MouseEvent) {
      const delta = event.clientX - activeResize.startX;
      const nextWidth = clampColumnWidth(
        activeResize.key,
        activeResize.startWidth + delta,
        activeResize.startWidth
      );
      setColumnWidths((current) => ({
        ...current,
        [activeResize.key]: nextWidth
      }));
    }

    function onMouseUp() {
      setResizing(null);
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [resizing]);

  const availableKinds = useMemo(() => {
    const found = new Set<TaxonomyKind>();
    tableRows.forEach((row) => found.add(row.kind));
    return (Object.keys(KIND_LABELS) as TaxonomyKind[]).filter((kind) => found.has(kind));
  }, [tableRows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const next = tableRows.filter((row) => {
      if (kindFilter !== 'all' && row.kind !== kindFilter) return false;
      if (statusFilter === 'active' && row.is_active === false) return false;
      if (statusFilter === 'archived' && row.is_active !== false) return false;
      if (!normalizedQuery) return true;
      return (
        row.id.toLowerCase().includes(normalizedQuery)
        || row.entity_subtype?.toLowerCase().includes(normalizedQuery)
        || row.name.toLowerCase().includes(normalizedQuery)
        || row.slug.toLowerCase().includes(normalizedQuery)
        || row.description.toLowerCase().includes(normalizedQuery)
        || `${row.blog_count}`.includes(normalizedQuery)
        || `${row.episode_count}`.includes(normalizedQuery)
      );
    });

    return next.sort((a, b) => {
      const byKind = KIND_LABELS[a.kind].localeCompare(KIND_LABELS[b.kind]);
      if (byKind !== 0) return byKind;
      return a.name.localeCompare(b.name);
    });
  }, [kindFilter, query, statusFilter, tableRows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const renderedColumns = useMemo(() => [...visibleColumns, FIXED_COLUMN] as ColumnKey[], [visibleColumns]);
  const tableMinWidth = renderedColumns.reduce((sum, key) => sum + (columnWidths[key] || 0), 0);
  const selectedDraftColumns = useMemo(
    () => draftColumns.map((key) => EDITABLE_COLUMNS.find((column) => column.key === key)).filter(Boolean) as Array<{ key: Exclude<ColumnKey, 'actions'>; label: string }>,
    [draftColumns]
  );
  const searchableColumns = useMemo(() => {
    const normalized = columnSearch.trim().toLowerCase();
    if (!normalized) return EDITABLE_COLUMNS;
    return EDITABLE_COLUMNS.filter((column) => column.label.toLowerCase().includes(normalized));
  }, [columnSearch]);

  function resetCreateForm() {
    setFormValues(EMPTY_FORM);
    setSlugManuallyEdited(false);
    setReactivateOnSave(false);
    setIsSaving(false);
  }

  function closeModal() {
    setCreateOpen(false);
    setEditingRow(null);
    resetCreateForm();
  }

  function startColumnResize(column: ColumnKey, event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (column === FIXED_COLUMN) {
      try {
        window.localStorage.setItem(TAXONOMY_ACTIONS_WIDTH_CUSTOMIZED_STORAGE_KEY, '1');
      } catch {
        // Ignore storage write failures in restricted contexts.
      }
    }
    setResizing({
      key: column,
      startX: event.clientX,
      startWidth: columnWidths[column]
    });
  }

  function openColumnEditor() {
    setDraftColumns(visibleColumns);
    setColumnSearch('');
    setColumnEditorOpen(true);
  }

  function toggleDraftColumn(columnKey: Exclude<ColumnKey, 'actions'>) {
    setDraftColumns((current) => {
      if (current.includes(columnKey)) return current.filter((key) => key !== columnKey);
      return [...current, columnKey];
    });
  }

  function applyColumnSelection() {
    if (!draftColumns.length) return;
    setVisibleColumns(draftColumns);
    setColumnEditorOpen(false);
  }

  function startEditing(row: WorkspaceTaxonomyRow) {
    setEditingRow(row);
    setSlugManuallyEdited(true);
    setReactivateOnSave(false);
    setFormValues({
      kind: row.kind,
      name: row.name || '',
      slug: row.slug || '',
      description: row.description || ''
    });
    setCreateOpen(true);
  }

  async function archiveTerm(row: WorkspaceTaxonomyRow) {
    if (!row.is_active) return;
    const confirmed = window.confirm(`Archive "${row.name}"? It will be set inactive.`);
    if (!confirmed) return;
    try {
      const response = await fetch(`/api/admin/discovery-terms/${row.id}`, { method: 'DELETE' });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        window.alert(result?.error || 'Failed to archive taxonomy.');
        return;
      }
      setTableRows((current) => current.map((item) => (item.id === row.id ? { ...item, is_active: false } : item)));
    } catch {
      window.alert('Failed to archive taxonomy.');
    }
  }

  function renderCell(row: WorkspaceTaxonomyRow, column: ColumnKey) {
    if (column === 'type') return <span className="whitespace-nowrap text-slate-700">{KIND_LABELS[row.kind]}</span>;
    if (column === 'id') return <span className="font-mono text-xs text-slate-700">{row.id}</span>;
    if (column === 'subtype') return <span className="whitespace-nowrap text-slate-700">{row.entity_subtype || '-'}</span>;
    if (column === 'name') return <span className="font-medium text-slate-900">{row.name}</span>;
    if (column === 'slug') return <span className="font-mono text-xs text-slate-700">{row.slug || '-'}</span>;
    if (column === 'description') return <span className="text-slate-700">{row.description || '-'}</span>;
    if (column === 'blog_count') return <span className="whitespace-nowrap text-slate-700">{row.blog_count}</span>;
    if (column === 'episode_count') return <span className="whitespace-nowrap text-slate-700">{row.episode_count}</span>;
    if (column === 'sort_order') return <span className="whitespace-nowrap text-slate-700">{row.sort_order ?? '-'}</span>;
    if (column === 'featured') return <span className="whitespace-nowrap text-slate-700">{row.is_featured ? 'Yes' : 'No'}</span>;
    if (column === 'created_at') return <span className="whitespace-nowrap text-slate-700">{formatShortDate(row.created_at)}</span>;
    if (column === 'updated_at') return <span className="whitespace-nowrap text-slate-700">{formatShortDate(row.updated_at)}</span>;

    if (column === 'actions') {
      return (
        <div className="flex w-max items-center justify-start gap-2">
          <button
            type="button"
            onClick={() => startEditing(row)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Edit
          </button>
          <button
            type="button"
            disabled={row.is_active === false}
            onClick={() => {
              void archiveTerm(row);
            }}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Archive
          </button>
        </div>
      );
    }

    if (row.is_active !== false) {
      return (
        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800">
          Active
        </span>
      );
    }

    return (
      <span className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-700">
        Archived
      </span>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            <span>Search</span>
            <span className="relative inline-block">
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.currentTarget.value);
                  setPage(1);
                }}
                placeholder="Name, slug, description"
                className="h-8 w-72 rounded-md border border-slate-300 px-2 py-1 pr-7 text-xs"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setPage(1);
                  }}
                  className="absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:text-slate-700"
                  aria-label="Clear search"
                >
                  <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3 w-3 stroke-current" fill="none" strokeWidth="1.8">
                    <path d="M2 2l8 8M10 2 2 10" />
                  </svg>
                </button>
              ) : null}
            </span>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            <span>Type</span>
            <span className="relative inline-block">
              <select
                value={kindFilter}
                onChange={(event) => {
                  setKindFilter(event.currentTarget.value as 'all' | TaxonomyKind);
                  setPage(1);
                }}
                className="h-8 min-w-[12rem] appearance-none rounded-md border border-slate-300 px-2 py-1 pr-7 text-xs"
              >
                <option value="all">All taxonomy types</option>
                {availableKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
              <svg
                aria-hidden="true"
                viewBox="0 0 10 6"
                className="pointer-events-none absolute right-2 top-1/2 h-[0.5rem] w-[0.5rem] -translate-y-1/2 fill-slate-600"
              >
                <path d="M5 6L0 0h10L5 6z" />
              </svg>
            </span>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            <span>Status</span>
            <span className="relative inline-block">
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.currentTarget.value as 'all' | 'active' | 'archived');
                  setPage(1);
                }}
                className="h-8 min-w-[10rem] appearance-none rounded-md border border-slate-300 px-2 py-1 pr-7 text-xs"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
              <svg
                aria-hidden="true"
                viewBox="0 0 10 6"
                className="pointer-events-none absolute right-2 top-1/2 h-[0.5rem] w-[0.5rem] -translate-y-1/2 fill-slate-600"
              >
                <path d="M5 6L0 0h10L5 6z" />
              </svg>
            </span>
          </label>
        </div>

        <button
          type="button"
          onClick={openColumnEditor}
          className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          Edit columns
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-slate-300 bg-white">
        <table className="w-max text-left text-sm" style={{ minWidth: `${tableMinWidth}px` }}>
          <colgroup>
            {renderedColumns.map((column) => (
              <col key={column} style={{ width: `${columnWidths[column]}px` }} />
            ))}
          </colgroup>
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {renderedColumns.map((column) => {
                const label = ALL_COLUMNS.find((item) => item.key === column)?.label || column;
                const isFixed = column === FIXED_COLUMN;
                return (
                  <th
                    key={column}
                    className={`relative border-l border-slate-300 py-2 font-semibold ${isFixed ? 'sticky right-0 z-20 bg-slate-100 px-2 text-left shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.25)]' : 'px-3'}`}
                  >
                    <span className={`pr-2 ${isFixed ? 'whitespace-nowrap' : ''}`}>{label}</span>
                    <button
                      type="button"
                      onMouseDown={(event) => startColumnResize(column, event)}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                      aria-label={`Resize ${label} column`}
                    >
                      <span className="mx-auto block h-full w-px bg-slate-300/0 transition-colors hover:bg-slate-400" />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => (
              <tr key={row.id} className="border-t border-slate-200 align-middle">
                {renderedColumns.map((column) => (
                  <td
                    key={`${row.id}:${column}`}
                    className={`py-2 text-slate-700 ${column === FIXED_COLUMN ? 'sticky right-0 z-10 bg-white px-2 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.2)]' : 'px-3'}`}
                  >
                    {renderCell(row, column)}
                  </td>
                ))}
              </tr>
            ))}
            {!pageRows.length ? (
              <tr>
                <td colSpan={renderedColumns.length} className="px-3 py-8 text-center text-sm text-slate-600">
                  No taxonomy items match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
        <p>
          Showing {(safePage - 1) * PAGE_SIZE + (pageRows.length ? 1 : 0)}-{(safePage - 1) * PAGE_SIZE + pageRows.length} of {filteredRows.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={safePage <= 1}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {safePage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={safePage >= totalPages}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {createOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={closeModal}>
          <form
            className="w-full max-w-2xl space-y-4 rounded-md border border-slate-300 bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            onSubmit={async (event) => {
              event.preventDefault();
              if (isSaving) return;
              setIsSaving(true);
              try {
                const payload = {
                  term_type: formValues.kind,
                  name: formValues.name.trim(),
                  slug: toSlug(formValues.slug) || toSlug(formValues.name),
                  description: formValues.description.trim(),
                  ...(editingRow && reactivateOnSave ? { is_active: true } : {})
                };

                const response = editingRow
                  ? await fetch(`/api/admin/discovery-terms/${editingRow.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                  })
                  : await fetch('/api/admin/discovery-terms', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                  });

                const result = await response.json().catch(() => ({}));
                if (!response.ok) {
                  window.alert(result?.error || `Failed to ${editingRow ? 'update' : 'create'} taxonomy.`);
                  setIsSaving(false);
                  return;
                }

                const saved = (result?.item || {}) as TaxonomyApiItem;
                const nextRow = toRow(saved);

                setTableRows((current) => {
                  const existing = current.find((item) => item.id === nextRow.id);
                  const hydratedRow = existing
                    ? { ...existing, ...nextRow, blog_count: existing.blog_count, episode_count: existing.episode_count }
                    : nextRow;
                  const without = current.filter((item) => item.id !== nextRow.id);
                  return [hydratedRow, ...without];
                });

                setPage(1);
                closeModal();
              } catch {
                window.alert(`Failed to ${editingRow ? 'update' : 'create'} taxonomy.`);
                setIsSaving(false);
              }
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{editingRow ? 'Edit taxonomy' : 'Create taxonomy'}</h2>
                <p className="text-sm text-slate-600">
                  {editingRow ? 'Update taxonomy details and slug.' : 'Add a new shared taxonomy term.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3.5 w-3.5 stroke-current" fill="none" strokeWidth="1.8">
                  <path d="M2 2l8 8M10 2 2 10" />
                </svg>
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                <span className="font-medium">Category</span>
                <select
                  value={formValues.kind}
                  onChange={(event) => {
                    const nextKind = event.target.value as TaxonomyKind;
                    setFormValues((current) => ({ ...current, kind: nextKind }));
                  }}
                  className="h-10 rounded-md border border-slate-300 px-3"
                >
                  {(Object.keys(KIND_LABELS) as TaxonomyKind[]).map((kind) => (
                    <option key={kind} value={kind}>
                      {KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-700">
                <span className="font-medium">Name</span>
                <input
                  value={formValues.name}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setFormValues((current) => ({
                      ...current,
                      name: value,
                      ...(!slugManuallyEdited ? { slug: toSlug(value) } : {})
                    }));
                  }}
                  placeholder="Taxonomy name"
                  required
                  className="h-10 rounded-md border border-slate-300 px-3"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-700 md:col-span-2">
                <span className="font-medium">Slug</span>
                <input
                  value={formValues.slug}
                  onChange={(event) => {
                    setSlugManuallyEdited(true);
                    setFormValues((current) => ({ ...current, slug: toSlug(event.currentTarget.value) }));
                  }}
                  placeholder="taxonomy-slug"
                  required
                  className="h-10 rounded-md border border-slate-300 px-3"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-700 md:col-span-2">
                <span className="font-medium">Description</span>
                <textarea
                  value={formValues.description}
                  onChange={(event) => setFormValues((current) => ({ ...current, description: event.currentTarget.value }))}
                  placeholder="Description"
                  rows={4}
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>

              {editingRow && editingRow.is_active === false ? (
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 md:col-span-2">
                  <input
                    type="checkbox"
                    checked={reactivateOnSave}
                    onChange={(event) => setReactivateOnSave(event.currentTarget.checked)}
                    className="h-4 w-4"
                  />
                  Reactivate taxonomy on save
                </label>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={closeModal} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving || !formValues.name.trim()}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (editingRow ? 'Saving...' : 'Creating...') : (editingRow ? 'Save taxonomy' : 'Create taxonomy')}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {columnEditorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setColumnEditorOpen(false)}>
          <div className="w-full max-w-3xl rounded-md border border-slate-300 bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-xl font-semibold text-slate-900">Choose which columns you see</h2>
              <button
                type="button"
                onClick={() => setColumnEditorOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3.5 w-3.5 stroke-current" fill="none" strokeWidth="1.8">
                  <path d="M2 2l8 8M10 2 2 10" />
                </svg>
              </button>
            </div>

            <div className="grid gap-4 p-5 md:grid-cols-2">
              <section className="rounded-md border border-slate-200">
                <div className="border-b border-slate-200 p-3">
                  <input
                    value={columnSearch}
                    onChange={(event) => setColumnSearch(event.target.value)}
                    placeholder="Search columns..."
                    className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm"
                  />
                </div>
                <div className="max-h-[340px] space-y-1 overflow-y-auto p-3">
                  {searchableColumns.map((column) => (
                    <label key={column.key} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={draftColumns.includes(column.key)}
                        onChange={() => toggleDraftColumn(column.key)}
                        className="h-4 w-4"
                      />
                      <span>{column.label}</span>
                    </label>
                  ))}
                </div>
              </section>

              <section className="rounded-md border border-slate-200 p-3">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Selected columns ({selectedDraftColumns.length + 1})
                </p>
                <div className="max-h-[340px] space-y-2 overflow-y-auto">
                  <div className="flex items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
                    <span className="font-medium text-slate-800">Actions</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fixed</span>
                  </div>
                  {selectedDraftColumns.map((column) => (
                    <div key={column.key} className="flex items-center justify-between rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
                      <span className="font-medium text-slate-800">{column.label}</span>
                      <button
                        type="button"
                        onClick={() => toggleDraftColumn(column.key)}
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        aria-label={`Remove ${column.label}`}
                      >
                        <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3.5 w-3.5 stroke-current" fill="none" strokeWidth="1.8">
                          <path d="M2 2l8 8M10 2 2 10" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  {!selectedDraftColumns.length ? (
                    <p className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                      Select at least one extra column. Actions always stays visible.
                    </p>
                  ) : null}
                </div>
              </section>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setDraftColumns(DEFAULT_VISIBLE_COLUMNS)}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Reset to Default
              </button>
              <button
                type="button"
                disabled={!draftColumns.length}
                onClick={applyColumnSelection}
                className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
