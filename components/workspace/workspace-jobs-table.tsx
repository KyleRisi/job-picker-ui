'use client';

import { type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Job } from '@/lib/types';

type JobWithHolder = Job & { filledBy?: string | null; filledByFull?: string | null; filledAt?: string | null; broadcastedOnShow?: boolean; broadcastedAt?: string | null };

type SortMode = 'newest' | 'oldest' | 'title';

type ColumnKey =
  | 'id'
  | 'jobRef'
  | 'title'
  | 'status'
  | 'reportsTo'
  | 'salaryBenefits'
  | 'description'
  | 'filledBy'
  | 'filledAt'
  | 'broadcastedOnShow'
  | 'rehiringReason';

type ColumnDefinition = {
  key: ColumnKey;
  label: string;
  width: number;
  headClassName?: string;
  cellClassName?: string;
  render: (job: JobWithHolder) => ReactNode;
};

const PAGE_SIZE = 25;
const WORKSPACE_JOBS_COLUMNS_KEY = 'workspace_jobs_visible_columns';
const MIN_COLUMN_WIDTH = 80;
const MAX_COLUMN_WIDTH = 1200;
const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
  'jobRef',
  'title',
  'status',
  'reportsTo',
  'salaryBenefits',
  'filledBy'
];

function compactValue(value: string, maxLength = 90): string {
  const normalized = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (!normalized) return '-';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function StatusPill({ status }: { status: string }) {
  const tones: Record<string, string> = {
    AVAILABLE: 'bg-emerald-100 text-emerald-800',
    FILLED: 'bg-rose-100 text-rose-800',
    REHIRING: 'bg-amber-100 text-amber-800'
  };

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${tones[status] || tones.AVAILABLE}`}>
      {status}
    </span>
  );
}

const ALL_COLUMNS: ColumnDefinition[] = [
  {
    key: 'jobRef',
    label: 'Ref',
    width: 130,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap font-mono text-xs text-slate-700',
    render: (job) => job.job_ref
  },
  {
    key: 'title',
    label: 'Title',
    width: 360,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'text-slate-700',
    render: (job) => (
      <p className="font-medium leading-snug text-slate-900 transition-colors group-hover:text-sky-700">
        {job.title}
      </p>
    )
  },
  {
    key: 'status',
    label: 'Status',
    width: 130,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (job) => <StatusPill status={job.status} />
  },
  {
    key: 'reportsTo',
    label: 'Reports To',
    width: 200,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (job) => job.reports_to || '-'
  },
  {
    key: 'salaryBenefits',
    label: 'Salary / Benefits',
    width: 260,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'text-slate-700',
    render: (job) => compactValue(job.salary_benefits || '-', 50)
  },
  {
    key: 'filledBy',
    label: 'Filled By',
    width: 160,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (job) => job.filledByFull || job.filledBy || '-'
  },
  {
    key: 'filledAt',
    label: 'Filled Date',
    width: 160,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (job) => {
      if (!job.filledAt) return '-';
      const date = new Date(job.filledAt);
      if (Number.isNaN(date.getTime())) return '-';
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  },
  {
    key: 'broadcastedOnShow',
    label: 'Broadcast',
    width: 130,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (job) => {
      if (job.status !== 'FILLED') return '-';
      return job.broadcastedOnShow ? (
        <span className="inline-flex rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-violet-800">
          Yes
        </span>
      ) : (
        <span className="inline-flex rounded-full bg-stone-200 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-stone-700">
          No
        </span>
      );
    }
  },
  {
    key: 'description',
    label: 'Description',
    width: 420,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'text-slate-700',
    render: (job) => <span title={job.description}>{compactValue(job.description, 120)}</span>
  },
  {
    key: 'rehiringReason',
    label: 'Rehiring Reason',
    width: 280,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'text-slate-700',
    render: (job) => compactValue(job.rehiring_reason || '-', 80)
  },
  {
    key: 'id',
    label: 'ID',
    width: 260,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (job) => <span title={job.id}>{compactValue(job.id, 36)}</span>
  }
];

const COLUMN_BY_KEY = new Map(ALL_COLUMNS.map((column) => [column.key, column]));
const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = ALL_COLUMNS.reduce((acc, column) => {
  acc[column.key] = column.width;
  return acc;
}, {} as Record<ColumnKey, number>);

function toPersistedColumns(value: unknown): ColumnKey[] {
  if (!Array.isArray(value)) return [];

  const validKeys = new Set(ALL_COLUMNS.map((column) => column.key));
  const normalized = value
    .map((item) => `${item}` as ColumnKey)
    .filter((item): item is ColumnKey => validKeys.has(item));

  if (!normalized.length) return [];

  const seen = new Set<ColumnKey>();
  const deduped: ColumnKey[] = [];
  normalized.forEach((key) => {
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(key);
  });

  return deduped;
}

function sanitizeColumnWidth(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  if (rounded < MIN_COLUMN_WIDTH) return MIN_COLUMN_WIDTH;
  if (rounded > MAX_COLUMN_WIDTH) return MAX_COLUMN_WIDTH;
  return rounded;
}

function toPersistedWidths(value: unknown): Partial<Record<ColumnKey, number>> {
  if (!value || typeof value !== 'object') return {};

  const input = value as Record<string, unknown>;
  const output: Partial<Record<ColumnKey, number>> = {};
  ALL_COLUMNS.forEach((column) => {
    if (!(column.key in input)) return;
    output[column.key] = sanitizeColumnWidth(input[column.key], column.width);
  });
  return output;
}

function toColumnWidths(value?: Partial<Record<ColumnKey, number>>): Record<ColumnKey, number> {
  return {
    ...DEFAULT_COLUMN_WIDTHS,
    ...(value || {})
  };
}

function persistTableConfig(columns: ColumnKey[], widths: Record<ColumnKey, number>) {
  try {
    window.localStorage.setItem(
      WORKSPACE_JOBS_COLUMNS_KEY,
      JSON.stringify({
        columns,
        widths
      })
    );
  } catch {
    // Ignore storage write failures in restricted browser contexts.
  }
}

export function WorkspaceJobsTable({ jobs }: { jobs: JobWithHolder[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(DEFAULT_COLUMN_WIDTHS);
  const [columnEditorOpen, setColumnEditorOpen] = useState(false);
  const [columnSearch, setColumnSearch] = useState('');
  const [draftColumns, setDraftColumns] = useState<ColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
  const [draggingColumn, setDraggingColumn] = useState<ColumnKey | null>(null);
  const [dragOverState, setDragOverState] = useState<{ key: ColumnKey; position: 'before' | 'after' } | null>(null);
  const [resizing, setResizing] = useState<{ key: ColumnKey; startX: number; startWidth: number } | null>(null);
  const [configRestored, setConfigRestored] = useState(false);
  const widthsRef = useRef(columnWidths);
  const columnsRef = useRef(visibleColumns);

  useLayoutEffect(() => {
    try {
      const raw = window.localStorage.getItem(WORKSPACE_JOBS_COLUMNS_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        const restoredColumns = toPersistedColumns(parsed);
        if (!restoredColumns.length) return;
        setVisibleColumns(restoredColumns);
        setDraftColumns(restoredColumns);
        return;
      }

      const restoredColumns = toPersistedColumns((parsed as { columns?: unknown }).columns);
      const restoredWidths = toPersistedWidths((parsed as { widths?: unknown }).widths);

      if (restoredColumns.length) {
        setVisibleColumns(restoredColumns);
        setDraftColumns(restoredColumns);
      }
      setColumnWidths(toColumnWidths(restoredWidths));
    } catch {
      // Ignore storage parse errors and keep defaults.
    } finally {
      setConfigRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!configRestored) return;
    persistTableConfig(visibleColumns, columnWidths);
  }, [visibleColumns, columnWidths, configRestored]);

  useEffect(() => {
    widthsRef.current = columnWidths;
  }, [columnWidths]);

  useEffect(() => {
    columnsRef.current = visibleColumns;
  }, [visibleColumns]);

  useEffect(() => {
    if (!resizing) return;

    const onMouseMove = (event: MouseEvent) => {
      const delta = event.clientX - resizing.startX;
      const next = sanitizeColumnWidth(resizing.startWidth + delta, resizing.startWidth);
      setColumnWidths((current) => {
        const updated = {
          ...current,
          [resizing.key]: next
        };
        widthsRef.current = updated;
        return updated;
      });
    };

    const onMouseUp = () => {
      persistTableConfig(columnsRef.current, widthsRef.current);
      setResizing(null);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [resizing]);

  const filteredJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = jobs.filter((job) => {
      if (statusFilter !== 'all' && job.status !== statusFilter) return false;

      if (!normalizedQuery) return true;

      return (
        job.title.toLowerCase().includes(normalizedQuery) ||
        job.job_ref.toLowerCase().includes(normalizedQuery) ||
        job.description.toLowerCase().includes(normalizedQuery)
      );
    });

    const sorted = [...filtered];

    if (sortMode === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      return sorted;
    }

    sorted.sort((a, b) => {
      const refA = Number.parseInt(a.job_ref.replace(/\D/g, ''), 10) || 0;
      const refB = Number.parseInt(b.job_ref.replace(/\D/g, ''), 10) || 0;
      return sortMode === 'oldest' ? refA - refB : refB - refA;
    });

    return sorted;
  }, [jobs, query, sortMode, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedJobs = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredJobs.slice(start, start + PAGE_SIZE);
  }, [filteredJobs, page]);

  const visibleColumnDefinitions = useMemo(() => {
    return visibleColumns
      .map((columnKey) => {
        const column = COLUMN_BY_KEY.get(columnKey);
        if (!column) return null;
        return {
          ...column,
          width: sanitizeColumnWidth(columnWidths[column.key], column.width)
        };
      })
      .filter((column): column is ColumnDefinition => Boolean(column));
  }, [visibleColumns, columnWidths]);

  const selectedDraftColumns = useMemo(() => {
    return draftColumns.map((columnKey) => COLUMN_BY_KEY.get(columnKey)).filter((column): column is ColumnDefinition => Boolean(column));
  }, [draftColumns]);

  const searchableColumns = useMemo(() => {
    const normalized = columnSearch.trim().toLowerCase();
    if (!normalized) return ALL_COLUMNS;
    return ALL_COLUMNS.filter((column) => column.label.toLowerCase().includes(normalized));
  }, [columnSearch]);

  const tableMinWidth = useMemo(() => {
    const sum = visibleColumnDefinitions.reduce((acc, column) => acc + column.width, 0);
    return Math.max(980, sum);
  }, [visibleColumnDefinitions]);

  function toggleDraftColumn(columnKey: ColumnKey) {
    setDraftColumns((current) => {
      if (current.includes(columnKey)) {
        return current.filter((key) => key !== columnKey);
      }
      return [...current, columnKey];
    });
  }

  function openColumnEditor() {
    setDraftColumns(visibleColumns);
    setColumnSearch('');
    setColumnEditorOpen(true);
  }

  function applyColumnSelection() {
    if (!draftColumns.length) return;
    const normalized = toPersistedColumns(draftColumns);
    if (!normalized.length) return;

    setVisibleColumns(normalized);
    persistTableConfig(normalized, columnWidths);
    setColumnEditorOpen(false);
  }

  function moveDraftColumn(fromKey: ColumnKey, toKey: ColumnKey, position: 'before' | 'after') {
    if (fromKey === toKey) return;

    setDraftColumns((current) => {
      const fromIndex = current.indexOf(fromKey);
      const toIndex = current.indexOf(toKey);
      if (fromIndex === -1 || toIndex === -1) return current;

      const reordered = [...current];
      const [moved] = reordered.splice(fromIndex, 1);
      const adjustedTargetIndex = fromIndex < toIndex ? toIndex - 1 : toIndex;
      const insertIndex = position === 'before' ? adjustedTargetIndex : adjustedTargetIndex + 1;
      reordered.splice(insertIndex, 0, moved);
      return reordered;
    });
  }

  function startColumnResize(columnKey: ColumnKey, event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const baseWidth = columnWidths[columnKey] ?? COLUMN_BY_KEY.get(columnKey)?.width ?? 160;
    setResizing({
      key: columnKey,
      startX: event.clientX,
      startWidth: baseWidth
    });
  }

  if (!jobs.length) {
    return (
      <div className="rounded-md border border-slate-300 bg-white p-6 text-sm text-slate-700">
        No jobs found.
      </div>
    );
  }

  if (!configRestored) {
    return (
      <section className="space-y-4">
        <div className="h-8" />
        <div className="rounded-md border border-slate-300 bg-white p-6 text-sm text-slate-600">
          Loading table layout...
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            <span>Search</span>
            <span className="relative inline-block">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Title, ref, or description"
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
          </div>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            <span>Status</span>
            <span className="relative inline-block">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-8 w-auto min-w-[8rem] appearance-none rounded-md border border-slate-300 px-2 py-1 pr-7 text-xs"
              >
                <option value="all">All statuses</option>
                <option value="AVAILABLE">Available</option>
                <option value="FILLED">Filled</option>
                <option value="REHIRING">Rehiring</option>
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
            <span>Sort</span>
            <span className="relative inline-block">
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="h-8 w-auto min-w-[10rem] appearance-none rounded-md border border-slate-300 px-2 py-1 pr-7 text-xs"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="title">Title A-Z</option>
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
            {visibleColumnDefinitions.map((column) => (
              <col key={column.key} style={{ width: `${column.width}px` }} />
            ))}
          </colgroup>

          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {visibleColumnDefinitions.map((column) => (
                <th
                  key={column.key}
                  className={`relative border-l border-slate-300 px-3 py-2 font-semibold ${column.headClassName || ''}`}
                  style={{ borderLeftWidth: '0.5px' }}
                >
                  <span className="pr-2">{column.label}</span>
                  <button
                    type="button"
                    onMouseDown={(event) => startColumnResize(column.key, event)}
                    className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none"
                    aria-label={`Resize ${column.label} column`}
                    title={`Resize ${column.label}`}
                  >
                    <span className="mx-auto block h-full w-px bg-slate-300/0 transition-colors hover:bg-slate-400" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {pagedJobs.map((job) => {
              const detailHref = `/jobs/${job.id}`;

              return (
                <tr
                  key={job.id}
                  className="group cursor-pointer border-t border-slate-200 align-middle transition-colors hover:bg-sky-50"
                  tabIndex={0}
                  onClick={() => router.push(detailHref)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      router.push(detailHref);
                    }
                  }}
                >
                  {visibleColumnDefinitions.map((column) => (
                    <td key={`${job.id}:${column.key}`} className={`align-middle px-3 py-2 ${column.cellClassName || 'text-slate-700'}`}>
                      {column.render(job)}
                    </td>
                  ))}
                </tr>
              );
            })}

            {!pagedJobs.length ? (
              <tr>
                <td colSpan={visibleColumnDefinitions.length} className="px-3 py-8 text-center text-sm text-slate-600">
                  No jobs match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
        <p>
          Showing {(page - 1) * PAGE_SIZE + (pagedJobs.length ? 1 : 0)}-{(page - 1) * PAGE_SIZE + pagedJobs.length} of {filteredJobs.length}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1}
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
            disabled={page >= totalPages}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {columnEditorOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setColumnEditorOpen(false)}>
          <div
            className="w-full max-w-4xl rounded-md border border-slate-300 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Edit columns"
            onClick={(event) => event.stopPropagation()}
          >
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
                  Selected columns ({selectedDraftColumns.length})
                </p>
                <div className="max-h-[340px] space-y-2 overflow-y-auto">
                  {selectedDraftColumns.map((column) => {
                    const showLineBefore = dragOverState?.key === column.key && dragOverState.position === 'before';
                    const showLineAfter = dragOverState?.key === column.key && dragOverState.position === 'after';

                    return (
                      <div key={column.key} className="space-y-2">
                        {showLineBefore ? <div className="h-0 border-t-2 border-blue-600" /> : null}
                        <div
                          draggable
                          onDragStart={() => setDraggingColumn(column.key)}
                          onDragEnd={() => {
                            setDraggingColumn(null);
                            setDragOverState(null);
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            const rect = event.currentTarget.getBoundingClientRect();
                            const midPoint = rect.top + rect.height / 2;
                            const position = event.clientY < midPoint ? 'before' : 'after';
                            setDragOverState({ key: column.key, position });
                          }}
                          onDragLeave={() => {
                            setDragOverState((current) => (current?.key === column.key ? null : current));
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (!draggingColumn) return;
                            const position = dragOverState?.key === column.key ? dragOverState.position : 'after';
                            moveDraftColumn(draggingColumn, column.key, position);
                            setDraggingColumn(null);
                            setDragOverState(null);
                          }}
                          className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                            draggingColumn === column.key
                              ? 'border-sky-300 bg-sky-50'
                              : 'border-slate-300 bg-slate-50'
                          }`}
                        >
                          <span className="inline-flex items-center gap-2 font-medium text-slate-800">
                            <span className="cursor-grab text-slate-400">::</span>
                            {column.label}
                          </span>
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
                        {showLineAfter ? <div className="h-0 border-t-2 border-blue-600" /> : null}
                      </div>
                    );
                  })}

                  {!selectedDraftColumns.length ? (
                    <p className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                      Select at least one column.
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
