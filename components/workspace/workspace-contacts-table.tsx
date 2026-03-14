'use client';

import { type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

export type WorkspaceContactSubmissionRow = {
  id: string;
  name: string;
  email: string;
  reason: 'general' | 'guest' | 'press' | 'sponsorship' | 'other';
  subject: string;
  message: string;
  status: 'new' | 'read' | 'archived';
  created_at: string;
};

type SortMode = 'newest' | 'oldest' | 'name';

type ColumnKey =
  | 'createdAt'
  | 'name'
  | 'email'
  | 'reason'
  | 'subject'
  | 'message'
  | 'status'
  | 'id'
  | 'actions';

type EditableColumnKey = Exclude<ColumnKey, 'actions'>;

type ColumnDefinition = {
  key: ColumnKey;
  label: string;
  width: number;
  headClassName?: string;
  cellClassName?: string;
  render: (submission: WorkspaceContactSubmissionRow) => ReactNode;
};
type EditableColumnDefinition = Omit<ColumnDefinition, 'key'> & { key: EditableColumnKey };

const PAGE_SIZE = 25;
const WORKSPACE_CONTACTS_COLUMNS_KEY = 'workspace_contacts_visible_columns';
const MIN_COLUMN_WIDTH = 80;
const MAX_COLUMN_WIDTH = 1200;
const FIXED_COLUMN: ColumnKey = 'actions';
const DEFAULT_VISIBLE_COLUMNS: EditableColumnKey[] = ['createdAt', 'name', 'email', 'reason', 'subject', 'message', 'status'];

function compactValue(value: string, maxLength = 90): string {
  const normalized = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (!normalized) return '-';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function reasonLabel(value: WorkspaceContactSubmissionRow['reason']): string {
  if (value === 'guest') return 'Guest request';
  if (value === 'press') return 'Press / media';
  if (value === 'sponsorship') return 'Sponsorship';
  if (value === 'other') return 'Other';
  return 'General enquiry';
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function EmailMessageModal({
  submission,
  onClose
}: {
  submission: WorkspaceContactSubmissionRow;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <article
        role="dialog"
        aria-modal="true"
        aria-label={`Contact submission from ${submission.name}`}
        className="flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-md border border-slate-300 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</p>
              <h2 className="text-xl font-semibold text-slate-900">{submission.subject || '(No subject)'}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close message"
            >
              <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3.5 w-3.5 stroke-current" fill="none" strokeWidth="1.8">
                <path d="M2 2l8 8M10 2 2 10" />
              </svg>
            </button>
          </div>
        </header>

        <section className="grid gap-3 border-b border-slate-200 px-5 py-4 text-sm sm:grid-cols-2">
          <div><span className="font-semibold text-slate-700">From:</span> {submission.name}</div>
          <div><span className="font-semibold text-slate-700">Email:</span> <a className="text-sky-700 underline" href={`mailto:${submission.email}`}>{submission.email}</a></div>
          <div><span className="font-semibold text-slate-700">Date:</span> {formatDateTime(submission.created_at)}</div>
          <div><span className="font-semibold text-slate-700">Reason:</span> {reasonLabel(submission.reason)}</div>
          <div className="sm:col-span-2"><span className="font-semibold text-slate-700">Status:</span> <span className="capitalize">{submission.status}</span></div>
        </section>

        <section className="flex-1 px-5 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Message</p>
          <div className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap rounded-md border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-800">
            {submission.message || '(No message body)'}
          </div>
        </section>
      </article>
    </div>
  );
}

function StatusPill({ status }: { status: WorkspaceContactSubmissionRow['status'] }) {
  const tones: Record<WorkspaceContactSubmissionRow['status'], string> = {
    new: 'bg-sky-100 text-sky-800',
    read: 'bg-emerald-100 text-emerald-800',
    archived: 'bg-slate-200 text-slate-700'
  };

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${tones[status]}`}>
      {status}
    </span>
  );
}

const ALL_COLUMNS: ColumnDefinition[] = [
  {
    key: 'createdAt',
    label: 'Date',
    width: 190,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (submission) => formatDateTime(submission.created_at)
  },
  {
    key: 'name',
    label: 'Name',
    width: 180,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (submission) => <span className="font-medium text-slate-900">{submission.name}</span>
  },
  {
    key: 'email',
    label: 'Email',
    width: 240,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (submission) => (
      <a href={`mailto:${submission.email}`} className="text-sky-700 underline hover:text-sky-800">
        {submission.email}
      </a>
    )
  },
  {
    key: 'reason',
    label: 'Reason',
    width: 160,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (submission) => reasonLabel(submission.reason)
  },
  {
    key: 'subject',
    label: 'Subject',
    width: 360,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'text-slate-700',
    render: (submission) => <span title={submission.subject}>{compactValue(submission.subject, 80)}</span>
  },
  {
    key: 'message',
    label: 'Message',
    width: 520,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'text-slate-700',
    render: (submission) => <span title={submission.message}>{compactValue(submission.message, 150)}</span>
  },
  {
    key: 'status',
    label: 'Status',
    width: 130,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (submission) => <StatusPill status={submission.status} />
  },
  {
    key: 'id',
    label: 'ID',
    width: 260,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (submission) => <span title={submission.id}>{compactValue(submission.id, 36)}</span>
  },
  {
    key: 'actions',
    label: 'Actions',
    width: 120,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: () => null
  }
];

const COLUMN_BY_KEY = new Map(ALL_COLUMNS.map((column) => [column.key, column]));
const EDITABLE_COLUMNS: EditableColumnDefinition[] = ALL_COLUMNS
  .filter((column): column is EditableColumnDefinition => column.key !== FIXED_COLUMN);
const EDITABLE_COLUMN_BY_KEY = new Map(EDITABLE_COLUMNS.map((column) => [column.key, column]));
const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = ALL_COLUMNS.reduce((acc, column) => {
  acc[column.key] = column.width;
  return acc;
}, {} as Record<ColumnKey, number>);

function toPersistedColumns(value: unknown): EditableColumnKey[] {
  if (!Array.isArray(value)) return [];

  const validKeys = new Set(EDITABLE_COLUMNS.map((column) => column.key));
  const normalized = value
    .map((item) => `${item}` as EditableColumnKey)
    .filter((item): item is EditableColumnKey => validKeys.has(item));

  if (!normalized.length) return [];

  const seen = new Set<EditableColumnKey>();
  const deduped: EditableColumnKey[] = [];
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

function toPersistedSortMode(value: unknown): SortMode | null {
  if (value !== 'newest' && value !== 'oldest' && value !== 'name') return null;
  return value;
}

function toPersistedStatusFilter(value: unknown): 'all' | WorkspaceContactSubmissionRow['status'] | null {
  if (value !== 'all' && value !== 'new' && value !== 'read' && value !== 'archived') return null;
  return value;
}

function toPersistedQuery(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value;
}

function persistTableConfig(
  columns: EditableColumnKey[],
  widths: Record<ColumnKey, number>,
  sortMode: SortMode,
  query: string,
  statusFilter: 'all' | WorkspaceContactSubmissionRow['status']
) {
  try {
    window.localStorage.setItem(
      WORKSPACE_CONTACTS_COLUMNS_KEY,
      JSON.stringify({
        columns,
        widths,
        sortMode,
        query,
        statusFilter
      })
    );
  } catch {
    // Ignore storage write failures in restricted browser contexts.
  }
}

export function WorkspaceContactsTable({
  submissions
}: {
  submissions: WorkspaceContactSubmissionRow[];
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | WorkspaceContactSubmissionRow['status']>('all');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<EditableColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(DEFAULT_COLUMN_WIDTHS);
  const [columnEditorOpen, setColumnEditorOpen] = useState(false);
  const [columnSearch, setColumnSearch] = useState('');
  const [draftColumns, setDraftColumns] = useState<EditableColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
  const [draggingColumn, setDraggingColumn] = useState<EditableColumnKey | null>(null);
  const [dragOverState, setDragOverState] = useState<{ key: EditableColumnKey; position: 'before' | 'after' } | null>(null);
  const [resizing, setResizing] = useState<{ key: ColumnKey; startX: number; startWidth: number } | null>(null);
  const [configRestored, setConfigRestored] = useState(false);
  const [activeSubmission, setActiveSubmission] = useState<WorkspaceContactSubmissionRow | null>(null);
  const widthsRef = useRef(columnWidths);
  const columnsRef = useRef(visibleColumns);
  const sortModeRef = useRef(sortMode);
  const queryRef = useRef(query);
  const statusFilterRef = useRef(statusFilter);

  useLayoutEffect(() => {
    try {
      const raw = window.localStorage.getItem(WORKSPACE_CONTACTS_COLUMNS_KEY);
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
      const restoredSortMode = toPersistedSortMode((parsed as { sortMode?: unknown }).sortMode);
      const restoredQuery = toPersistedQuery((parsed as { query?: unknown }).query);
      const restoredStatusFilter = toPersistedStatusFilter((parsed as { statusFilter?: unknown }).statusFilter);

      if (restoredColumns.length) {
        setVisibleColumns(restoredColumns);
        setDraftColumns(restoredColumns);
      }
      setColumnWidths(toColumnWidths(restoredWidths));
      if (restoredSortMode) {
        setSortMode(restoredSortMode);
      }
      if (restoredQuery !== null) {
        setQuery(restoredQuery);
      }
      if (restoredStatusFilter) {
        setStatusFilter(restoredStatusFilter);
      }
    } catch {
      // Ignore storage parse errors and keep defaults.
    } finally {
      setConfigRestored(true);
    }
  }, []);

  useEffect(() => {
    if (!configRestored) return;
    persistTableConfig(visibleColumns, columnWidths, sortMode, query, statusFilter);
  }, [visibleColumns, columnWidths, sortMode, query, statusFilter, configRestored]);

  useEffect(() => {
    widthsRef.current = columnWidths;
  }, [columnWidths]);

  useEffect(() => {
    columnsRef.current = visibleColumns;
  }, [visibleColumns]);

  useEffect(() => {
    sortModeRef.current = sortMode;
  }, [sortMode]);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    statusFilterRef.current = statusFilter;
  }, [statusFilter]);

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
      persistTableConfig(columnsRef.current, widthsRef.current, sortModeRef.current, queryRef.current, statusFilterRef.current);
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

  useEffect(() => {
    if (!activeSubmission) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveSubmission(null);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeSubmission]);

  const filteredSubmissions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = submissions.filter((submission) => {
      if (statusFilter !== 'all' && submission.status !== statusFilter) return false;
      if (!normalizedQuery) return true;

      return (
        submission.name.toLowerCase().includes(normalizedQuery) ||
        submission.email.toLowerCase().includes(normalizedQuery) ||
        submission.subject.toLowerCase().includes(normalizedQuery) ||
        submission.message.toLowerCase().includes(normalizedQuery)
      );
    });

    const sorted = [...filtered];
    if (sortMode === 'name') {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      return sorted;
    }

    sorted.sort((a, b) => {
      const left = new Date(a.created_at).getTime();
      const right = new Date(b.created_at).getTime();
      const safeLeft = Number.isNaN(left) ? 0 : left;
      const safeRight = Number.isNaN(right) ? 0 : right;
      return sortMode === 'oldest' ? safeLeft - safeRight : safeRight - safeLeft;
    });

    return sorted;
  }, [submissions, query, statusFilter, sortMode]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filteredSubmissions.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedSubmissions = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredSubmissions.slice(start, start + PAGE_SIZE);
  }, [filteredSubmissions, page]);

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
  const fixedColumnDefinition = useMemo(() => {
    const column = COLUMN_BY_KEY.get(FIXED_COLUMN);
    if (!column) return null;
    return {
      ...column,
      width: sanitizeColumnWidth(columnWidths[column.key], column.width)
    } as ColumnDefinition;
  }, [columnWidths]);
  const renderedColumnDefinitions = useMemo(
    () => fixedColumnDefinition ? [...visibleColumnDefinitions, fixedColumnDefinition] : visibleColumnDefinitions,
    [fixedColumnDefinition, visibleColumnDefinitions]
  );

  const selectedDraftColumns = useMemo(() => {
    return draftColumns
      .map((columnKey) => EDITABLE_COLUMN_BY_KEY.get(columnKey))
      .filter((column): column is EditableColumnDefinition => Boolean(column));
  }, [draftColumns]);

  const searchableColumns = useMemo(() => {
    const normalized = columnSearch.trim().toLowerCase();
    if (!normalized) return EDITABLE_COLUMNS;
    return EDITABLE_COLUMNS.filter((column) => column.label.toLowerCase().includes(normalized));
  }, [columnSearch]);

  const tableMinWidth = useMemo(() => {
    const sum = renderedColumnDefinitions.reduce((acc, column) => acc + column.width, 0);
    return Math.max(980, sum);
  }, [renderedColumnDefinitions]);

  function toggleDraftColumn(columnKey: EditableColumnKey) {
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
    persistTableConfig(normalized, columnWidths, sortMode, query, statusFilter);
    setColumnEditorOpen(false);
  }

  function moveDraftColumn(fromKey: EditableColumnKey, toKey: EditableColumnKey, position: 'before' | 'after') {
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
                placeholder="Name, email, subject, or message"
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
                onChange={(event) => setStatusFilter(event.target.value as 'all' | WorkspaceContactSubmissionRow['status'])}
                className="h-8 w-auto min-w-[8rem] appearance-none rounded-md border border-slate-300 px-2 py-1 pr-7 text-xs"
              >
                <option value="all">All statuses</option>
                <option value="new">New</option>
                <option value="read">Read</option>
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
                <option value="name">Name A-Z</option>
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
            {renderedColumnDefinitions.map((column) => (
              <col key={column.key} style={{ width: `${column.width}px` }} />
            ))}
          </colgroup>

          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {renderedColumnDefinitions.map((column) => {
                const isFixed = column.key === FIXED_COLUMN;
                return (
                  <th
                    key={column.key}
                    className={`relative border-l border-slate-300 py-2 font-semibold ${
                      column.headClassName || ''
                    } ${
                      isFixed
                        ? 'sticky right-0 z-20 bg-slate-100 px-2 text-left shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.25)]'
                        : 'px-3'
                    }`}
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
                );
              })}
            </tr>
          </thead>

          <tbody>
            {pagedSubmissions.map((submission) => (
              <tr
                key={submission.id}
                className="group border-t border-slate-200 align-middle transition-colors hover:bg-sky-50"
              >
                {renderedColumnDefinitions.map((column) => {
                  const isFixed = column.key === FIXED_COLUMN;
                  return (
                    <td
                      key={`${submission.id}:${column.key}`}
                      className={`align-middle py-2 ${column.cellClassName || 'text-slate-700'} ${
                        isFixed
                          ? 'sticky right-0 z-10 bg-white px-2 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.2)] group-hover:bg-sky-50'
                          : 'px-3'
                      }`}
                    >
                      {column.key === 'actions' ? (
                        <div
                          className="space-y-1.5"
                          onClick={(event) => event.stopPropagation()}
                          onMouseDown={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => setActiveSubmission(submission)}
                            className="inline-flex h-7 items-center justify-center rounded-md bg-blue-600 px-2.5 text-xs font-semibold text-white hover:bg-blue-700"
                          >
                            Read
                          </button>
                        </div>
                      ) : (
                        column.render(submission)
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}

            {!pagedSubmissions.length ? (
              <tr>
                <td colSpan={renderedColumnDefinitions.length} className="px-3 py-8 text-center text-sm text-slate-600">
                  No contact submissions match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
        <p>
          Showing {(page - 1) * PAGE_SIZE + (pagedSubmissions.length ? 1 : 0)}-{(page - 1) * PAGE_SIZE + pagedSubmissions.length} of {filteredSubmissions.length}
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
                <p className="px-3 pt-2 text-xs text-slate-500">
                  Actions is fixed and always visible.
                </p>
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

      {activeSubmission ? (
        <EmailMessageModal submission={activeSubmission} onClose={() => setActiveSubmission(null)} />
      ) : null}
    </section>
  );
}
