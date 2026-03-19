'use client';

import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useState } from 'react';

type RedirectItem = {
  id: string;
  source: string;
  target: string | null;
  status_code: 301 | 302 | 307 | 308 | 410;
  owner_layer: string;
  source_type: string;
  editable: boolean;
  rule_type: string;
  notes_reason: string;
  active: boolean;
  backing_type: 'table_backed' | 'system_generated';
  backing_ref: string;
  read_only_reason: string | null;
  match_type: 'exact' | 'prefix';
  priority: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type RedirectsResponse = {
  items: RedirectItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type FormState = {
  source_path: string;
  target_url: string;
  status_code: '301' | '302' | '307' | '308';
  match_type: 'exact' | 'prefix';
  is_active: boolean;
  priority: string;
  notes: string;
};

type ColumnKey = 'select' | 'view' | 'source' | 'target' | 'status' | 'owner' | 'editable' | 'backing' | 'match' | 'active' | 'priority' | 'updated' | 'actions';
type ResizeState = { key: ColumnKey; startX: number; startWidth: number } | null;

const REDIRECT_STATUS_CODES: Array<301 | 302 | 307 | 308> = [301, 302, 307, 308];
const REDIRECT_FILTER_STATUS_CODES: Array<301 | 302 | 307 | 308 | 410> = [301, 302, 307, 308, 410];
const REDIRECT_MATCH_TYPES: Array<'exact' | 'prefix'> = ['exact', 'prefix'];

const DEFAULT_FORM: FormState = {
  source_path: '',
  target_url: '',
  status_code: '301',
  match_type: 'exact',
  is_active: true,
  priority: '100',
  notes: ''
};

const REDIRECT_COLUMN_WIDTHS_STORAGE_KEY = 'workspace_redirects_column_widths';
const REDIRECT_VISIBLE_COLUMNS_STORAGE_KEY = 'workspace_redirects_visible_columns';
const MIN_COLUMN_WIDTH = 100;
const MAX_COLUMN_WIDTH = 1200;
const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = {
  select: 90,
  view: 100,
  source: 260,
  target: 360,
  status: 120,
  owner: 170,
  editable: 120,
  backing: 160,
  match: 120,
  active: 120,
  priority: 110,
  updated: 170,
  actions: 120
};
const ALL_COLUMNS: Array<{ key: ColumnKey; label: string }> = [
  { key: 'select', label: 'Select' },
  { key: 'view', label: 'View' },
  { key: 'source', label: 'Source' },
  { key: 'target', label: 'Target' },
  { key: 'status', label: 'Status' },
  { key: 'owner', label: 'Owner' },
  { key: 'editable', label: 'Editable' },
  { key: 'backing', label: 'Backing' },
  { key: 'match', label: 'Match' },
  { key: 'active', label: 'Active' },
  { key: 'priority', label: 'Priority' },
  { key: 'updated', label: 'Updated' },
  { key: 'actions', label: 'Actions' }
];
const FIXED_COLUMN: ColumnKey = 'actions';
const EDITABLE_COLUMNS: Array<{ key: Exclude<ColumnKey, 'actions'>; label: string }> = ALL_COLUMNS.filter(
  (column): column is { key: Exclude<ColumnKey, 'actions'>; label: string } => column.key !== FIXED_COLUMN
);
const DEFAULT_VISIBLE_COLUMNS: Array<Exclude<ColumnKey, 'actions'>> = EDITABLE_COLUMNS.map((column) => column.key);

function validateSourcePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'Source path is required.';
  if (!trimmed.startsWith('/')) return 'Source path must start with "/".';
  if (/\s/.test(trimmed)) return 'Source path cannot contain spaces.';
  return '';
}

function isSafeTargetUrl(input: string): boolean {
  const target = (input || '').trim();
  if (!target) return false;
  if (target.startsWith('/')) return true;
  try {
    const url = new URL(target);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function validateTargetUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return 'Target URL is required.';
  if (trimmed.startsWith('/')) {
    if (/\s/.test(trimmed)) return 'Internal target paths cannot contain spaces.';
    return '';
  }
  if (!isSafeTargetUrl(trimmed)) return 'Target must be an internal path or a valid http/https URL.';
  return '';
}

function formatDate(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toViewUrl(source: string): string {
  if (/^https?:\/\//i.test(source)) return source;
  if (typeof window === 'undefined') return source;
  try {
    return new URL(source, window.location.origin).toString();
  } catch {
    return source;
  }
}

function isTableBackedEditable(item: RedirectItem): boolean {
  return item.editable && item.backing_type === 'table_backed';
}

export function WorkspaceRedirectsTable() {
  const [items, setItems] = useState<RedirectItem[]>([]);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all');
  const [matchTypeFilter, setMatchTypeFilter] = useState<'all' | 'exact' | 'prefix'>('all');
  const [statusCodeFilter, setStatusCodeFilter] = useState<'all' | '301' | '302' | '307' | '308' | '410'>('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RedirectItem | null>(null);

  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<'upsert' | 'replace'>('upsert');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(DEFAULT_COLUMN_WIDTHS);
  const [resizing, setResizing] = useState<ResizeState>(null);
  const [widthsRestored, setWidthsRestored] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Array<Exclude<ColumnKey, 'actions'>>>(DEFAULT_VISIBLE_COLUMNS);
  const [columnEditorOpen, setColumnEditorOpen] = useState(false);
  const [columnSearch, setColumnSearch] = useState('');
  const [draftColumns, setDraftColumns] = useState<Array<Exclude<ColumnKey, 'actions'>>>(DEFAULT_VISIBLE_COLUMNS);
  const [columnsRestored, setColumnsRestored] = useState(false);

  const sourcePathError = useMemo(() => validateSourcePath(form.source_path), [form.source_path]);
  const targetUrlError = useMemo(() => validateTargetUrl(form.target_url), [form.target_url]);
  const hasValidationErrors = Boolean(sourcePathError || targetUrlError);

  const renderedColumns = useMemo(() => [...visibleColumns, FIXED_COLUMN] as ColumnKey[], [visibleColumns]);
  const tableMinWidth = useMemo(
    () => renderedColumns.reduce((sum, key) => sum + (columnWidths[key] || 0), 0),
    [columnWidths, renderedColumns]
  );
  const selectedDraftColumns = useMemo(
    () => draftColumns.map((key) => EDITABLE_COLUMNS.find((column) => column.key === key)).filter(Boolean) as Array<{ key: Exclude<ColumnKey, 'actions'>; label: string }>,
    [draftColumns]
  );
  const searchableColumns = useMemo(() => {
    const normalized = columnSearch.trim().toLowerCase();
    if (!normalized) return EDITABLE_COLUMNS;
    return EDITABLE_COLUMNS.filter((column) => column.label.toLowerCase().includes(normalized));
  }, [columnSearch]);
  const selectableVisibleIds = useMemo(() => items.filter(isTableBackedEditable).map((item) => item.id), [items]);
  const selectedCount = selectedIds.size;
  const allVisibleSelected = selectableVisibleIds.length > 0 && selectableVisibleIds.every((id) => selectedIds.has(id));

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(REDIRECT_COLUMN_WIDTHS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<Record<ColumnKey, number>>;
        setColumnWidths((current) => ({
          ...current,
          ...Object.fromEntries(
            (Object.keys(DEFAULT_COLUMN_WIDTHS) as ColumnKey[]).map((key) => {
              const raw = Number(parsed[key] ?? current[key]);
              const bounded = Number.isFinite(raw)
                ? Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(raw)))
                : current[key];
              return [key, bounded];
            })
          )
        }));
      }
    } catch {
      // Ignore storage read failures.
    } finally {
      setWidthsRestored(true);
    }
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(REDIRECT_VISIBLE_COLUMNS_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return;
      const valid = parsed.filter(
        (key): key is Exclude<ColumnKey, 'actions'> => EDITABLE_COLUMNS.some((column) => column.key === key)
      );
      if (!valid.length) return;

      const requiredColumns: Array<Exclude<ColumnKey, 'actions'>> = ['select', 'view'];
      const withRequired = [
        ...requiredColumns,
        ...valid.filter((key) => !requiredColumns.includes(key))
      ] as Array<Exclude<ColumnKey, 'actions'>>;
      setVisibleColumns(withRequired);
      setDraftColumns(withRequired);
    } catch {
      // Ignore storage parse failures.
    } finally {
      setColumnsRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!widthsRestored) return;
    try {
      window.localStorage.setItem(REDIRECT_COLUMN_WIDTHS_STORAGE_KEY, JSON.stringify(columnWidths));
    } catch {
      // Ignore storage write failures.
    }
  }, [columnWidths, widthsRestored]);

  useEffect(() => {
    if (!columnsRestored) return;
    try {
      window.localStorage.setItem(REDIRECT_VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns));
    } catch {
      // Ignore storage write failures.
    }
  }, [visibleColumns, columnsRestored]);

  function persistVisibleColumns(columns: Array<Exclude<ColumnKey, 'actions'>>) {
    try {
      window.localStorage.setItem(REDIRECT_VISIBLE_COLUMNS_STORAGE_KEY, JSON.stringify(columns));
    } catch {
      // Ignore storage write failures.
    }
  }

  useEffect(() => {
    if (!resizing) return;
    const activeResize = resizing;
    function onMouseMove(event: MouseEvent) {
      const delta = event.clientX - activeResize.startX;
      const nextWidth = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, Math.round(activeResize.startWidth + delta)));
      setColumnWidths((current) => ({ ...current, [activeResize.key]: nextWidth }));
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

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: `${page}` });
      if (query.trim()) params.set('q', query.trim());
      if (activeFilter !== 'all') params.set('is_active', activeFilter);
      if (matchTypeFilter !== 'all') params.set('match_type', matchTypeFilter);
      if (statusCodeFilter !== 'all') params.set('status_code', statusCodeFilter);

      const response = await fetch(`/api/admin/redirects/unified?${params.toString()}`, { cache: 'no-store' });
      const data = (await response.json().catch(() => ({}))) as RedirectsResponse | { error?: string };
      if (!response.ok) throw new Error((data as { error?: string }).error || 'Failed to load redirects.');
      const payload = data as RedirectsResponse;
      setItems(payload.items || []);
      setTotal(payload.pagination?.total || 0);
      setTotalPages(payload.pagination?.totalPages || 1);
    } catch (loadError) {
      setItems([]);
      setTotal(0);
      setTotalPages(1);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load redirects.');
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, matchTypeFilter, page, query, statusCodeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onNew() {
      setForm(DEFAULT_FORM);
      setCreateOpen(true);
    }
    function onImport() {
      setImportOpen(true);
    }
    window.addEventListener('workspace-redirects:new', onNew);
    window.addEventListener('workspace-redirects:import', onImport);
    return () => {
      window.removeEventListener('workspace-redirects:new', onNew);
      window.removeEventListener('workspace-redirects:import', onImport);
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [query, activeFilter, matchTypeFilter, statusCodeFilter]);

  function startColumnResize(column: ColumnKey, event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
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
    persistVisibleColumns(draftColumns);
    setColumnEditorOpen(false);
  }

  function toggleSelection(id: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAllVisible(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of selectableVisibleIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function renderCell(item: RedirectItem, column: ColumnKey) {
    if (column === 'select') {
      const disabled = !isTableBackedEditable(item);
      return (
        <input
          type="checkbox"
          checked={selectedIds.has(item.id)}
          disabled={disabled}
          onChange={(event) => {
            const checked = event.currentTarget.checked;
            toggleSelection(item.id, checked);
          }}
          className="h-4 w-4 rounded border-slate-300"
          aria-label={`Select ${item.source}`}
        />
      );
    }
    if (column === 'view') {
      const viewUrl = toViewUrl(item.source);
      return (
        <a
          href={viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          View
        </a>
      );
    }
    if (column === 'source') return <span className="font-mono text-xs text-slate-700">{item.source}</span>;
    if (column === 'target') return <span className="text-slate-700">{item.target || '-'}</span>;
    if (column === 'status') return <span className="text-slate-700">{item.status_code}</span>;
    if (column === 'owner') return <span className="text-slate-700">{item.owner_layer}</span>;
    if (column === 'editable') {
      return item.editable ? (
        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800">
          Editable
        </span>
      ) : (
        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
          Read-only
        </span>
      );
    }
    if (column === 'backing') return <span className="text-slate-700">{item.backing_type}</span>;
    if (column === 'match') return <span className="text-slate-700">{item.match_type}</span>;
    if (column === 'active') {
      return item.active ? (
        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800">
          Active
        </span>
      ) : (
        <span className="inline-flex rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-700">
          Inactive
        </span>
      );
    }
    if (column === 'priority') return <span className="text-slate-700">{item.priority ?? '-'}</span>;
    if (column === 'updated') return <span className="text-slate-700">{formatDate(item.updated_at)}</span>;

    if (!item.editable || item.backing_type !== 'table_backed') {
      return (
        <span className="text-xs font-semibold text-slate-500" title={item.read_only_reason || 'Read-only system rule.'}>
          Read-only
        </span>
      );
    }

    return (
      <button
        type="button"
        onClick={() => openEdit(item)}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Edit
      </button>
    );
  }

  function closeCreate() {
    setCreateOpen(false);
    setForm(DEFAULT_FORM);
    setIsSaving(false);
  }

  function closeEdit() {
    setEditOpen(false);
    setEditingItem(null);
    setForm(DEFAULT_FORM);
    setIsSaving(false);
    setIsDeleting(false);
  }

  function closeImport() {
    setImportOpen(false);
    setImportMode('upsert');
    setImportFile(null);
    setIsImporting(false);
  }

  async function createRedirect() {
    if (hasValidationErrors) return;
    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        source_path: form.source_path.trim(),
        target_url: form.target_url.trim(),
        status_code: Number.parseInt(form.status_code, 10),
        match_type: form.match_type,
        is_active: form.is_active,
        priority: Number.parseInt(form.priority || '100', 10),
        notes: form.notes
      };
      const response = await fetch('/api/admin/redirects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to save redirect.');
      setMessage('Redirect created.');
      closeCreate();
      setPage(1);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save redirect.');
      setIsSaving(false);
    }
  }

  async function updateRedirect() {
    if (!editingItem || hasValidationErrors) return;
    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        source_path: form.source_path.trim(),
        target_url: form.target_url.trim(),
        status_code: Number.parseInt(form.status_code, 10),
        match_type: form.match_type,
        is_active: form.is_active,
        priority: Number.parseInt(form.priority || '100', 10),
        notes: form.notes
      };
      const response = await fetch(`/api/admin/redirects/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to save redirect.');
      setMessage('Redirect updated.');
      closeEdit();
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save redirect.');
      setIsSaving(false);
    }
  }

  async function deleteRedirect() {
    if (!editingItem) return;
    const confirmed = window.confirm('Delete this redirect? This cannot be undone.');
    if (!confirmed) return;
    setIsDeleting(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/admin/redirects/${editingItem.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to delete redirect.');
      setMessage('Redirect deleted.');
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(editingItem.id);
        return next;
      });
      closeEdit();
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete redirect.');
      setIsDeleting(false);
    }
  }

  async function importCsv() {
    if (!importFile) return;
    setIsImporting(true);
    setError('');
    setMessage('');
    try {
      const csv = await importFile.text();
      const response = await fetch('/api/admin/redirects/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, mode: importMode })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Failed to import CSV.');
      setMessage(data?.message || 'Import complete.');
      closeImport();
      setPage(1);
      await load();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Failed to import CSV.');
      setIsImporting(false);
    }
  }

  async function deleteSelectedRedirects() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    const confirmed = window.confirm('Are you sure?');
    if (!confirmed) return;

    setIsBulkDeleting(true);
    setError('');
    setMessage('');

    const failedIds: string[] = [];
    for (const id of ids) {
      try {
        const response = await fetch(`/api/admin/redirects/${id}`, { method: 'DELETE' });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || 'Failed to delete redirect.');
      } catch {
        failedIds.push(id);
      }
    }

    if (!failedIds.length) {
      setMessage(`${ids.length} redirects deleted.`);
      setSelectedIds(new Set());
      await load();
      setIsBulkDeleting(false);
      return;
    }

    const deletedCount = ids.length - failedIds.length;
    if (deletedCount > 0) {
      setMessage(`${deletedCount} redirects deleted.`);
    }
    setError(`Failed to delete ${failedIds.length} selected redirect(s).`);
    setSelectedIds(new Set(failedIds));
    await load();
    setIsBulkDeleting(false);
  }

  function openEdit(item: RedirectItem) {
    if (!item.editable || item.backing_type !== 'table_backed') return;
    setEditingItem(item);
    setForm({
      source_path: item.source,
      target_url: item.target || '',
      status_code: `${item.status_code}` as FormState['status_code'],
      match_type: item.match_type,
      is_active: item.active,
      priority: `${item.priority ?? 100}`,
      notes: item.notes_reason || ''
    });
    setEditOpen(true);
  }

  return (
    <section className="space-y-4">
      {message ? <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
      {error ? <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            <span>Search</span>
            <span className="relative inline-block">
              <input
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Source or target"
                className="h-8 w-72 rounded-md border border-slate-300 px-2 py-1 pr-7 text-xs"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
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
            <span>Active</span>
            <span className="relative inline-block">
              <select
                value={activeFilter}
                onChange={(event) => setActiveFilter(event.currentTarget.value as 'all' | 'true' | 'false')}
                className="h-8 min-w-[8rem] appearance-none rounded-md border border-slate-300 px-2 py-1 pr-7 text-xs"
              >
                <option value="all">All</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
              <svg aria-hidden="true" viewBox="0 0 10 6" className="pointer-events-none absolute right-2 top-1/2 h-[0.5rem] w-[0.5rem] -translate-y-1/2 fill-slate-600">
                <path d="M5 6L0 0h10L5 6z" />
              </svg>
            </span>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            <span>Match</span>
            <span className="relative inline-block">
              <select
                value={matchTypeFilter}
                onChange={(event) => setMatchTypeFilter(event.currentTarget.value as 'all' | 'exact' | 'prefix')}
                className="h-8 min-w-[8rem] appearance-none rounded-md border border-slate-300 px-2 py-1 pr-7 text-xs"
              >
                <option value="all">All</option>
                <option value="exact">Exact</option>
                <option value="prefix">Prefix</option>
              </select>
              <svg aria-hidden="true" viewBox="0 0 10 6" className="pointer-events-none absolute right-2 top-1/2 h-[0.5rem] w-[0.5rem] -translate-y-1/2 fill-slate-600">
                <path d="M5 6L0 0h10L5 6z" />
              </svg>
            </span>
          </label>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            <span>Status</span>
            <span className="relative inline-block">
              <select
                value={statusCodeFilter}
                onChange={(event) => setStatusCodeFilter(event.currentTarget.value as 'all' | '301' | '302' | '307' | '308' | '410')}
                className="h-8 min-w-[8rem] appearance-none rounded-md border border-slate-300 px-2 py-1 pr-7 text-xs"
              >
                <option value="all">All</option>
                {REDIRECT_FILTER_STATUS_CODES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <svg aria-hidden="true" viewBox="0 0 10 6" className="pointer-events-none absolute right-2 top-1/2 h-[0.5rem] w-[0.5rem] -translate-y-1/2 fill-slate-600">
                <path d="M5 6L0 0h10L5 6z" />
              </svg>
            </span>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void deleteSelectedRedirects()}
            disabled={!selectedCount || isBulkDeleting}
            className="inline-flex h-8 items-center justify-center rounded-md border border-rose-300 bg-white px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isBulkDeleting ? 'Deleting...' : `Delete All${selectedCount ? ` (${selectedCount})` : ''}`}
          </button>
          <button
            type="button"
            onClick={openColumnEditor}
            className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Edit columns
          </button>
        </div>
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
                if (column === 'select') {
                  return (
                    <th
                      key={column}
                      className="relative border-l border-slate-300 px-3 py-2 font-semibold"
                    >
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        disabled={!selectableVisibleIds.length}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked;
                          toggleSelectAllVisible(checked);
                        }}
                        className="h-4 w-4 rounded border-slate-300"
                        aria-label="Select all visible redirects"
                      />
                    </th>
                  );
                }
                return (
                  <th
                    key={column}
                    className={`relative border-l border-slate-300 px-3 py-2 font-semibold ${isFixed ? 'sticky right-0 z-20 bg-slate-100 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.25)]' : ''}`}
                  >
                    <span className="pr-2">{label}</span>
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
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-200 align-middle">
                {renderedColumns.map((column) => (
                  <td
                    key={`${item.id}:${column}`}
                    className={`px-3 py-2 text-slate-700 ${column === FIXED_COLUMN ? 'sticky right-0 z-10 bg-white shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.2)]' : ''}`}
                  >
                    {renderCell(item, column)}
                  </td>
                ))}
              </tr>
            ))}

            {!items.length && !isLoading ? (
              <tr>
                <td colSpan={renderedColumns.length} className="px-3 py-8 text-center text-sm text-slate-600">
                  No redirects match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
        <p>
          {isLoading ? 'Loading redirects...' : `Showing ${(page - 1) * 25 + (items.length ? 1 : 0)}-${(page - 1) * 25 + items.length} of ${total}`}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || isLoading}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages || isLoading}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {(createOpen || editOpen) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={createOpen ? closeCreate : closeEdit}>
          <div className="w-full max-w-2xl space-y-4 rounded-md border border-slate-300 bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{createOpen ? 'Create redirect' : 'Edit redirect'}</h2>
                <p className="text-sm text-slate-600">Manage source path, target, matching, and status behavior.</p>
              </div>
              <button
                type="button"
                onClick={createOpen ? closeCreate : closeEdit}
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
                <span className="font-medium">Source path</span>
                <input
                  value={form.source_path}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setForm((current) => ({ ...current, source_path: value }));
                  }}
                  onBlur={(event) => {
                    const raw = event.currentTarget.value.trim();
                    if (!raw || raw.startsWith('/')) return;
                    setForm((current) => ({ ...current, source_path: `/${raw}` }));
                  }}
                  placeholder="/old-path"
                  className="h-10 rounded-md border border-slate-300 px-3"
                />
                {sourcePathError ? <span className="text-xs font-medium text-rose-600">{sourcePathError}</span> : null}
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-700">
                <span className="font-medium">Target URL</span>
                <input
                  value={form.target_url}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setForm((current) => ({ ...current, target_url: value }));
                  }}
                  placeholder="/new-path or https://..."
                  className="h-10 rounded-md border border-slate-300 px-3"
                />
                {targetUrlError ? <span className="text-xs font-medium text-rose-600">{targetUrlError}</span> : null}
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-700">
                <span className="font-medium">Match type</span>
                <select
                  value={form.match_type}
                  onChange={(event) => {
                    const value = event.currentTarget.value as 'exact' | 'prefix';
                    setForm((current) => ({ ...current, match_type: value }));
                  }}
                  className="h-10 rounded-md border border-slate-300 px-3"
                >
                  {REDIRECT_MATCH_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-700">
                <span className="font-medium">Status code</span>
                <select
                  value={form.status_code}
                  onChange={(event) => {
                    const value = event.currentTarget.value as FormState['status_code'];
                    setForm((current) => ({ ...current, status_code: value }));
                  }}
                  className="h-10 rounded-md border border-slate-300 px-3"
                >
                  {REDIRECT_STATUS_CODES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-700">
                <span className="font-medium">Priority</span>
                <input
                  type="number"
                  min={0}
                  value={form.priority}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setForm((current) => ({ ...current, priority: value }));
                  }}
                  className="h-10 rounded-md border border-slate-300 px-3"
                />
              </label>

              <label className="flex items-center gap-2 pt-6 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => {
                    const checked = event.currentTarget.checked;
                    setForm((current) => ({ ...current, is_active: checked }));
                  }}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Active
              </label>

              <label className="flex flex-col gap-1 text-sm text-slate-700 md:col-span-2">
                <span className="font-medium">Notes</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    setForm((current) => ({ ...current, notes: value }));
                  }}
                  rows={3}
                  placeholder="Optional notes"
                  className="rounded-md border border-slate-300 px-3 py-2"
                />
              </label>
            </div>

            <div className="flex items-center justify-between gap-2">
              <div>
                {editOpen ? (
                  <button
                    type="button"
                    onClick={() => void deleteRedirect()}
                    disabled={isDeleting || isSaving}
                    className="rounded-md border border-rose-300 px-3 py-1.5 text-sm font-medium text-rose-700 disabled:opacity-60"
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={createOpen ? closeCreate : closeEdit}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void (createOpen ? createRedirect() : updateRedirect())}
                  disabled={isSaving || hasValidationErrors}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? 'Saving...' : createOpen ? 'Create redirect' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {importOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={closeImport}>
          <div className="w-full max-w-xl space-y-4 rounded-md border border-slate-300 bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Import CSV</h2>
                <p className="text-sm text-slate-600">CSV headers: source_path,target_url,status_code,match_type,priority,notes</p>
              </div>
              <button
                type="button"
                onClick={closeImport}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3.5 w-3.5 stroke-current" fill="none" strokeWidth="1.8">
                  <path d="M2 2l8 8M10 2 2 10" />
                </svg>
              </button>
            </div>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              <span className="font-medium">Import mode</span>
              <select
                value={importMode}
                onChange={(event) => setImportMode(event.currentTarget.value as 'upsert' | 'replace')}
                className="h-10 rounded-md border border-slate-300 px-3"
              >
                <option value="upsert">Upsert (recommended)</option>
                <option value="replace">Replace all</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              <span className="font-medium">CSV file</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => setImportFile(event.currentTarget.files?.[0] || null)}
                className="rounded-md border border-slate-300 px-3 py-2"
              />
            </label>

            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={closeImport} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void importCsv()}
                disabled={!importFile || isImporting}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isImporting ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
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
