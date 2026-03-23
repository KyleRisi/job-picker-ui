'use client';

import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';

type SortDirection = 'asc' | 'desc';
type ColumnKey =
  | 'title'
  | 'description'
  | 'topicCategory'
  | 'submitter'
  | 'origin'
  | 'coverage'
  | 'coveredEpisode'
  | 'status'
  | 'votes'
  | 'identity'
  | 'verified'
  | 'created'
  | 'actions';
type SortState = { column: ColumnKey; direction: SortDirection };
type DragOverPosition = 'before' | 'after';
type DragOverState = { key: EditableColumnKey; position: DragOverPosition } | null;

const PAGE_SIZE = 25;
const STORAGE_COLUMNS_KEY = 'workspace_freaky_register_visible_columns';
const STORAGE_SORT_KEY = 'workspace_freaky_register_sort';
const STORAGE_WIDTHS_KEY = 'workspace_freaky_register_column_widths';
const FIXED_COLUMN: ColumnKey = 'actions';
const MIN_COLUMN_WIDTH = 80;
const MAX_COLUMN_WIDTH = 1200;
const ACTIONS_COLUMN_WIDTH = 132;

const SORTABLE_COLUMNS = new Set<ColumnKey>(['title', 'topicCategory', 'submitter', 'origin', 'coverage', 'status', 'votes', 'created']);

export type WorkspaceFreakyModerationRow = {
  id: string;
  title: string;
  description: string;
  status: string;
  is_visible: boolean;
  upvote_count: number;
  created_at: string;
  verification_completed_at: string | null;
  duplicate_of_suggestion_id: string | null;
  submitted_by_identity_id: string | null;
  submitted_name: string;
  submitted_full_name: string;
  submitted_country: string;
  topic_term_id: string | null;
  topic_slug: string;
  topic_name: string;
  covered_episode_id: string | null;
  covered_at: string | null;
  covered_episode: {
    id: string;
    title: string;
    slug: string;
    published_at: string | null;
  } | null;
  freaky_identities: {
    id: string;
    email: string;
    email_verified_at: string | null;
    is_blocked: boolean;
    blocked_at: string | null;
    block_reason: string;
  } | null;
};

type EpisodeOption = {
  id: string;
  title: string;
  slug: string;
  published_at: string | null;
};

type EditableColumnKey = Exclude<ColumnKey, 'actions'>;

type ColumnDefinition = {
  key: ColumnKey;
  label: string;
  width: number;
  headClassName?: string;
  cellClassName?: string;
  render: (row: WorkspaceFreakyModerationRow) => ReactNode;
};

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return '-';
  return parsed.toLocaleString();
}

function statusChipClass(status: string): string {
  switch (status) {
    case 'published':
      return 'bg-emerald-100 text-emerald-800';
    case 'pending_verification':
      return 'bg-amber-100 text-amber-800';
    case 'hidden':
      return 'bg-slate-200 text-slate-700';
    case 'spam':
      return 'bg-rose-100 text-rose-800';
    case 'removed':
      return 'bg-rose-100 text-rose-800';
    case 'duplicate':
      return 'bg-violet-100 text-violet-800';
    case 'expired_unverified':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-slate-200 text-slate-700';
  }
}

const ALL_COLUMNS: ColumnDefinition[] = [
  {
    key: 'title',
    label: 'Topic Title',
    width: 260,
    render: (row) => (
      <div className="space-y-1">
        <p className="font-semibold text-slate-900">{row.title}</p>
        {row.duplicate_of_suggestion_id ? <p className="text-[11px] text-slate-500">Duplicate of: {row.duplicate_of_suggestion_id}</p> : null}
      </div>
    )
  },
  {
    key: 'description',
    label: 'Description',
    width: 420,
    render: (row) => (
      <p className="max-w-2xl text-xs leading-relaxed text-slate-600">{row.description}</p>
    )
  },
  {
    key: 'topicCategory',
    label: 'Topic Category',
    width: 180,
    headClassName: 'whitespace-nowrap',
    render: (row) => (
      <p className="text-xs font-semibold text-slate-700">{row.topic_name || '-'}</p>
    )
  },
  {
    key: 'submitter',
    label: 'Submitter',
    width: 170,
    headClassName: 'whitespace-nowrap',
    render: (row) => (
      <p className="text-xs text-slate-700">{row.submitted_full_name || '-'}</p>
    )
  },
  {
    key: 'origin',
    label: 'Origin',
    width: 170,
    headClassName: 'whitespace-nowrap',
    render: (row) => (
      <p className="text-xs text-slate-700">{row.submitted_country || '-'}</p>
    )
  },
  {
    key: 'coverage',
    label: 'Coverage',
    width: 130,
    headClassName: 'whitespace-nowrap',
    render: (row) => {
      if (row.status === 'removed') {
        return (
          <span className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-rose-800">
            Removed
          </span>
        );
      }
      if (row.covered_episode_id) {
        return (
          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-800">
            Covered
          </span>
        );
      }
      return (
        <span className="rounded-full bg-slate-200 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-700">
          Open
        </span>
      );
    }
  },
  {
    key: 'coveredEpisode',
    label: 'Covered Episode',
    width: 260,
    headClassName: 'whitespace-nowrap',
    render: (row) => row.covered_episode ? (
      <div className="space-y-1">
        <a
          href={`/episodes/${row.covered_episode.slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-blue-700 underline underline-offset-2"
        >
          {row.covered_episode.title}
        </a>
        <p className="text-[11px] text-slate-500">{row.covered_at ? formatDate(row.covered_at) : '-'}</p>
      </div>
    ) : (
      <p className="text-xs text-slate-500">Not linked</p>
    )
  },
  {
    key: 'status',
    label: 'Status',
    width: 150,
    headClassName: 'whitespace-nowrap',
    render: (row) => (
      <div>
        <span className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${statusChipClass(row.status)}`}>
          {row.status}
        </span>
      </div>
    )
  },
  {
    key: 'votes',
    label: 'Votes',
    width: 100,
    headClassName: 'whitespace-nowrap text-center',
    cellClassName: 'text-center font-semibold text-slate-800',
    render: (row) => row.upvote_count
  },
  {
    key: 'identity',
    label: 'Email Address',
    width: 240,
    render: (row) => {
      const identity = row.freaky_identities;
      if (!identity) return <p className="text-xs text-slate-500">No identity attached</p>;
      return (
        <p className="text-xs text-slate-900">{identity.email}</p>
      );
    }
  },
  {
    key: 'verified',
    label: 'Verified',
    width: 180,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'text-xs text-slate-700',
    render: (row) => row.freaky_identities?.email_verified_at ? formatDate(row.freaky_identities.email_verified_at) : 'Not verified'
  },
  {
    key: 'created',
    label: 'Created',
    width: 180,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'text-xs text-slate-700',
    render: (row) => formatDate(row.created_at)
  },
  {
    key: 'actions',
    label: 'Actions',
    width: ACTIONS_COLUMN_WIDTH,
    headClassName: 'whitespace-nowrap',
    render: () => null
  }
];

const EDITABLE_COLUMNS: EditableColumnKey[] = [
  'title',
  'description',
  'topicCategory',
  'submitter',
  'origin',
  'coverage',
  'coveredEpisode',
  'status',
  'votes',
  'identity',
  'verified',
  'created'
];
const DEFAULT_VISIBLE_COLUMNS: EditableColumnKey[] = [
  'title',
  'description',
  'topicCategory',
  'submitter',
  'origin',
  'coverage',
  'coveredEpisode',
  'status',
  'votes',
  'created'
];
const COLUMN_BY_KEY = new Map(ALL_COLUMNS.map((column) => [column.key, column]));
const DEFAULT_COLUMN_WIDTHS: Record<ColumnKey, number> = ALL_COLUMNS.reduce((acc, column) => {
  acc[column.key] = column.width;
  return acc;
}, {} as Record<ColumnKey, number>);

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

function toPersistedColumns(value: unknown): EditableColumnKey[] {
  if (!Array.isArray(value)) return [];
  const valid = new Set(EDITABLE_COLUMNS);
  const deduped: EditableColumnKey[] = [];
  const seen = new Set<EditableColumnKey>();
  value.forEach((item) => {
    const key = `${item}` as EditableColumnKey;
    if (!valid.has(key) || seen.has(key)) return;
    seen.add(key);
    deduped.push(key);
  });
  return deduped;
}

function toPersistedSort(value: unknown): SortState | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  if (typeof obj.column !== 'string' || typeof obj.direction !== 'string') return null;
  const column = obj.column as ColumnKey;
  const direction = obj.direction as SortDirection;
  if (!SORTABLE_COLUMNS.has(column)) return null;
  if (direction !== 'asc' && direction !== 'desc') return null;
  return { column, direction };
}

function getSortValue(row: WorkspaceFreakyModerationRow, column: ColumnKey): string | number {
  switch (column) {
    case 'title': return row.title.toLowerCase();
    case 'topicCategory': return (row.topic_name || '').toLowerCase();
    case 'submitter': return (row.submitted_full_name || '').toLowerCase();
    case 'origin': return (row.submitted_country || '').toLowerCase();
    case 'coverage': return row.covered_episode_id ? 1 : 0;
    case 'status': return row.status.toLowerCase();
    case 'votes': return row.upvote_count;
    case 'created': return new Date(row.created_at).getTime() || 0;
    default: return 0;
  }
}

export function WorkspaceFreakyRegisterTable({ rows }: { rows: WorkspaceFreakyModerationRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busyKey, setBusyKey] = useState('');
  const [message, setMessage] = useState('');
  const [openActionsRowId, setOpenActionsRowId] = useState<string | null>(null);
  const [coverTargetRow, setCoverTargetRow] = useState<WorkspaceFreakyModerationRow | null>(null);
  const [episodeQuery, setEpisodeQuery] = useState('');
  const [episodeOptions, setEpisodeOptions] = useState<EpisodeOption[]>([]);
  const [episodeLoading, setEpisodeLoading] = useState(false);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState('');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortState>({ column: 'created', direction: 'desc' });
  const [configRestored, setConfigRestored] = useState(false);

  const [visibleColumns, setVisibleColumns] = useState<EditableColumnKey[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_VISIBLE_COLUMNS;
    try {
      const raw = window.localStorage.getItem(STORAGE_COLUMNS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const restored = toPersistedColumns(parsed);
      return restored.length ? restored : DEFAULT_VISIBLE_COLUMNS;
    } catch {
      return DEFAULT_VISIBLE_COLUMNS;
    }
  });

  const [columnEditorOpen, setColumnEditorOpen] = useState(false);
  const [columnSearch, setColumnSearch] = useState('');
  const [draftColumns, setDraftColumns] = useState<EditableColumnKey[]>(visibleColumns);
  const [draggingColumn, setDraggingColumn] = useState<EditableColumnKey | null>(null);
  const [dragOverState, setDragOverState] = useState<DragOverState>(null);
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(DEFAULT_COLUMN_WIDTHS);
  const resizeStateRef = useRef<{ key: ColumnKey; startX: number; baseWidth: number } | null>(null);
  const widthsRef = useRef(columnWidths);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_SORT_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      const restored = toPersistedSort(parsed);
      if (restored) setSort(restored);

      const rawWidths = window.localStorage.getItem(STORAGE_WIDTHS_KEY);
      const parsedWidths = rawWidths ? JSON.parse(rawWidths) : null;
      setColumnWidths(toColumnWidths(toPersistedWidths(parsedWidths)));
    } catch {
      // noop
    } finally {
      setConfigRestored(true);
    }
  }, []);

  useEffect(() => {
    widthsRef.current = columnWidths;
  }, [columnWidths]);

  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;
      const delta = event.clientX - state.startX;
      const next = sanitizeColumnWidth(state.baseWidth + delta, DEFAULT_COLUMN_WIDTHS[state.key]);
      setColumnWidths((current) => ({ ...current, [state.key]: next }));
    };

    const onUp = () => {
      resizeStateRef.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  useEffect(() => {
    if (!configRestored || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_COLUMNS_KEY, JSON.stringify(visibleColumns));
      window.localStorage.setItem(STORAGE_SORT_KEY, JSON.stringify(sort));
      window.localStorage.setItem(STORAGE_WIDTHS_KEY, JSON.stringify(columnWidths));
    } catch {
      // noop
    }
  }, [visibleColumns, sort, columnWidths, configRestored]);

  useEffect(() => {
    if (!coverTargetRow) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setEpisodeLoading(true);
      try {
        const params = new URLSearchParams();
        if (episodeQuery.trim()) params.set('q', episodeQuery.trim());
        const response = await fetch(`/api/admin/freaky-register/episodes?${params.toString()}`);
        const data = await response.json().catch(() => ({}));
        if (!cancelled && response.ok && Array.isArray(data.items)) {
          setEpisodeOptions(data.items as EpisodeOption[]);
        }
      } finally {
        if (!cancelled) setEpisodeLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [coverTargetRow, episodeQuery]);

  const statusOptions = useMemo(() => {
    const set = new Set(rows.map((row) => row.status));
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'en-GB'))];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    let filtered = rows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (!q) return true;
      return (
        row.title.toLowerCase().includes(q)
        || row.description.toLowerCase().includes(q)
        || row.status.toLowerCase().includes(q)
        || (row.freaky_identities?.email || '').toLowerCase().includes(q)
        || (row.topic_name || '').toLowerCase().includes(q)
        || (row.covered_episode?.title || '').toLowerCase().includes(q)
      );
    });

    const { column, direction } = sort;
    filtered = [...filtered].sort((a, b) => {
      const av = getSortValue(a, column);
      const bv = getSortValue(b, column);
      if (typeof av === 'number' && typeof bv === 'number') {
        return direction === 'asc' ? av - bv : bv - av;
      }
      return direction === 'asc'
        ? `${av}`.localeCompare(`${bv}`, 'en-GB')
        : `${bv}`.localeCompare(`${av}`, 'en-GB');
    });

    return filtered;
  }, [query, rows, sort, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);

  const pagedRows = useMemo(() => {
    const start = (pageSafe - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, pageSafe]);

  const selectedDraftColumns = useMemo(() => {
    return draftColumns
      .map((key) => COLUMN_BY_KEY.get(key))
      .filter((column): column is ColumnDefinition => Boolean(column));
  }, [draftColumns]);

  const searchableColumns = useMemo(() => {
    const q = columnSearch.trim().toLowerCase();
    const columns = EDITABLE_COLUMNS
      .map((key) => COLUMN_BY_KEY.get(key))
      .filter((column): column is ColumnDefinition => Boolean(column));
    if (!q) return columns;
    return columns.filter((column) => column.label.toLowerCase().includes(q));
  }, [columnSearch]);

  const renderedColumns = useMemo(() => {
    const editable = visibleColumns
      .map((key) => COLUMN_BY_KEY.get(key))
      .filter((column): column is ColumnDefinition => Boolean(column));
    const fixed = COLUMN_BY_KEY.get(FIXED_COLUMN);
    const columns = fixed ? [...editable, fixed] : editable;
    return columns.map((column) => ({
      ...column,
      width: sanitizeColumnWidth(columnWidths[column.key], column.width)
    }));
  }, [visibleColumns, columnWidths]);

  const tableMinWidth = useMemo(() => {
    return renderedColumns.reduce((sum, column) => sum + column.width, 0);
  }, [renderedColumns]);

  async function moderateSuggestion(
    suggestionId: string,
    action: 'hide' | 'unhide' | 'spam' | 'remove' | 'mark_duplicate' | 'mark_covered' | 'clear_covered' | 'set_votes',
    payloadExtras?: Record<string, unknown>
  ) {
    setBusyKey(`${suggestionId}:${action}`);
    setMessage('');

    try {
      let payload: Record<string, unknown> = { action, ...(payloadExtras || {}) };
      if (action === 'mark_duplicate') {
        const duplicateOfSuggestionId = window.prompt('Duplicate of suggestion ID:');
        if (!duplicateOfSuggestionId) return;
        payload = { action, duplicateOfSuggestionId: duplicateOfSuggestionId.trim() };
      } else if (action === 'set_votes') {
        const currentCount = Number(payloadExtras?.upvoteCount ?? 0);
        const entered = window.prompt('Set vote count:', `${currentCount}`);
        if (entered === null) return;
        const parsed = Number.parseInt(entered.trim(), 10);
        if (!Number.isFinite(parsed) || parsed < 0) {
          setMessage('Vote count must be a non-negative whole number.');
          return;
        }
        payload = { action, upvoteCount: parsed };
      }

      const response = await fetch(`/api/admin/freaky-register/${suggestionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data?.error || 'Moderation action failed.');
        return;
      }
      setMessage('Suggestion moderation updated.');
      router.refresh();
    } finally {
      setBusyKey('');
    }
  }

  function openCoverPicker(row: WorkspaceFreakyModerationRow) {
    setCoverTargetRow(row);
    setEpisodeQuery('');
    setSelectedEpisodeId('');
    setEpisodeOptions([]);
  }

  async function confirmCoverSuggestion() {
    if (!coverTargetRow || !selectedEpisodeId) {
      setMessage('Please select an episode.');
      return;
    }
    await moderateSuggestion(coverTargetRow.id, 'mark_covered', { episodeId: selectedEpisodeId });
    setCoverTargetRow(null);
    setSelectedEpisodeId('');
    setEpisodeQuery('');
  }

  async function moderateIdentity(identityId: string, action: 'block' | 'unblock') {
    setBusyKey(`${identityId}:${action}`);
    setMessage('');

    try {
      const reason = action === 'block'
        ? (window.prompt('Block reason (optional):') || '').trim()
        : '';

      const response = await fetch(`/api/admin/freaky-register/identities/${identityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data?.error || 'Identity moderation failed.');
        return;
      }
      setMessage(action === 'block' ? 'Identity blocked.' : 'Identity unblocked.');
      router.refresh();
    } finally {
      setBusyKey('');
    }
  }

  function openColumnEditor() {
    setDraftColumns(visibleColumns);
    setColumnSearch('');
    setColumnEditorOpen(true);
  }

  function toggleDraftColumn(key: EditableColumnKey) {
    setDraftColumns((current) => {
      if (current.includes(key)) return current.filter((item) => item !== key);
      return [...current, key];
    });
  }

  function moveDraftColumn(sourceKey: EditableColumnKey, targetKey: EditableColumnKey, position: DragOverPosition) {
    if (sourceKey === targetKey) return;
    setDraftColumns((current) => {
      const sourceIndex = current.indexOf(sourceKey);
      const targetIndex = current.indexOf(targetKey);
      if (sourceIndex === -1 || targetIndex === -1) return current;

      const next = [...current];
      next.splice(sourceIndex, 1);
      const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
      const adjustedInsertIndex = sourceIndex < targetIndex ? insertIndex - 1 : insertIndex;
      next.splice(Math.max(0, Math.min(next.length, adjustedInsertIndex)), 0, sourceKey);
      return next;
    });
  }

  function applyColumnSelection() {
    const normalized = draftColumns.filter((key, idx) => draftColumns.indexOf(key) === idx);
    setVisibleColumns(normalized.length ? normalized : [DEFAULT_VISIBLE_COLUMNS[0]]);
    setColumnEditorOpen(false);
  }

  function startColumnResize(columnKey: ColumnKey, event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    const baseWidth = columnWidths[columnKey] ?? COLUMN_BY_KEY.get(columnKey)?.width ?? 160;
    resizeStateRef.current = {
      key: columnKey,
      startX: event.clientX,
      baseWidth
    };
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            <span>Search</span>
            <span className="relative inline-block">
              <input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                placeholder="Topic, description, status, email"
                className="h-8 w-72 rounded-md border border-slate-300 px-2 py-1 pr-7 text-xs"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => { setQuery(''); setPage(1); }}
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
            <span>Status</span>
            <span className="relative inline-block">
              <select
                value={statusFilter}
                onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}
                className="h-8 min-w-[10rem] appearance-none rounded-md border border-slate-300 px-2 py-1 pr-7 text-xs"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status === 'all' ? 'All statuses' : status}</option>
                ))}
              </select>
              <svg aria-hidden="true" viewBox="0 0 10 6" className="pointer-events-none absolute right-2 top-1/2 h-[0.5rem] w-[0.5rem] -translate-y-1/2 fill-slate-600">
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

      {message ? (
        <p className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">{message}</p>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-slate-300 bg-white">
        <table className="w-max table-auto border-collapse text-left text-sm" style={{ minWidth: `${tableMinWidth}px` }}>
          <colgroup>
            {renderedColumns.map((column) => (
              <col key={column.key} style={{ width: `${column.width}px` }} />
            ))}
          </colgroup>
          <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
            <tr>
              {renderedColumns.map((column) => {
                const isFixed = column.key === FIXED_COLUMN;
                const sortable = SORTABLE_COLUMNS.has(column.key);
                return (
                  <th
                    key={column.key}
                    className={`relative border-l border-slate-300 py-2 font-semibold ${column.headClassName || ''} ${isFixed ? 'sticky right-0 z-20 bg-slate-100 px-2 text-left shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.25)]' : 'px-3'} ${sortable ? 'cursor-pointer select-none' : ''}`}
                    style={{ borderLeftWidth: '0.5px' }}
                    onClick={sortable ? () => {
                      setSort((prev) => prev.column === column.key
                        ? { column: column.key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                        : { column: column.key, direction: 'asc' }
                      );
                      setPage(1);
                    } : undefined}
                  >
                    <span className="inline-flex items-center gap-1 pr-2">
                      {column.label}
                      {sortable ? (
                        <svg aria-hidden="true" viewBox="0 0 8 14" className={`h-3 w-2 shrink-0 ${sort.column === column.key ? 'fill-slate-800' : 'fill-slate-400'}`}>
                          <path d={sort.column === column.key && sort.direction === 'desc' ? 'M4 10l4-5H0z' : sort.column === column.key && sort.direction === 'asc' ? 'M4 4L0 9h8z' : 'M4 0l4 5H0zM4 14l4-5H0z'} />
                        </svg>
                      ) : null}
                    </span>
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
            {pagedRows.map((row, rowIndex) => {
              const identity = row.freaky_identities;
              const openActionsUpward = rowIndex >= Math.max(0, pagedRows.length - 3);
              return (
                <tr key={row.id} className="group border-t border-slate-200 align-top transition-colors hover:bg-sky-50">
                  {renderedColumns.map((column) => {
                    const isFixed = column.key === FIXED_COLUMN;
                    const fixedClass = isFixed ? 'sticky right-0 z-10 bg-white px-2 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.2)] group-hover:bg-sky-50' : 'px-3';

                    if (column.key === 'actions') {
                      const isActionsOpen = openActionsRowId === row.id;
                      return (
                        <td
                          key={`${row.id}:${column.key}`}
                          className={`relative py-2 align-top ${fixedClass} ${isActionsOpen ? 'z-40' : ''}`}
                        >
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={() => setOpenActionsRowId((current) => current === row.id ? null : row.id)}
                              disabled={Boolean(busyKey)}
                              className="inline-flex h-7 items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Actions
                            </button>

                            {isActionsOpen ? (
                              <div
                                className={[
                                  'absolute right-0 z-50 min-w-[170px] rounded-md border border-slate-200 bg-white p-1.5 shadow-lg',
                                  openActionsUpward ? 'bottom-full mb-1' : 'top-full mt-1'
                                ].join(' ')}
                              >
                                <button
                                  type="button"
                                  onClick={() => { setOpenActionsRowId(null); void moderateSuggestion(row.id, 'hide'); }}
                                  className="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                  Hide
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setOpenActionsRowId(null); void moderateSuggestion(row.id, 'unhide'); }}
                                  className="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                  Unhide
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setOpenActionsRowId(null); void moderateSuggestion(row.id, 'spam'); }}
                                  className="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                  Spam
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setOpenActionsRowId(null); void moderateSuggestion(row.id, 'remove'); }}
                                  className="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                  Remove
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setOpenActionsRowId(null); void moderateSuggestion(row.id, 'mark_duplicate'); }}
                                  className="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                  Duplicate
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setOpenActionsRowId(null); void moderateSuggestion(row.id, 'set_votes', { upvoteCount: row.upvote_count }); }}
                                  className="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                  Set vote count
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setOpenActionsRowId(null); openCoverPicker(row); }}
                                  className="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                  Mark as covered episode
                                </button>
                                {row.covered_episode_id ? (
                                  <button
                                    type="button"
                                    onClick={() => { setOpenActionsRowId(null); void moderateSuggestion(row.id, 'clear_covered'); }}
                                    className="block w-full rounded px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                                  >
                                    Clear covered episode
                                  </button>
                                ) : null}
                                {identity ? (
                                  <button
                                    type="button"
                                    onClick={() => { setOpenActionsRowId(null); void moderateIdentity(identity.id, identity.is_blocked ? 'unblock' : 'block'); }}
                                    className={[
                                      'mt-1 block w-full rounded px-2 py-1.5 text-left text-xs font-semibold hover:bg-slate-100',
                                      identity.is_blocked ? 'text-emerald-700' : 'text-rose-700'
                                    ].join(' ')}
                                  >
                                    {identity.is_blocked ? 'Unblock identity' : 'Block identity'}
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={`${row.id}:${column.key}`} className={`py-2 align-top ${column.cellClassName || 'text-slate-700'} ${fixedClass}`}>
                        {column.render(row)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {!pagedRows.length ? (
              <tr>
                <td colSpan={renderedColumns.length} className="px-3 py-8 text-center text-sm text-slate-600">
                  No suggestions match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
        <p>
          Showing {(pageSafe - 1) * PAGE_SIZE + (pagedRows.length ? 1 : 0)}-{(pageSafe - 1) * PAGE_SIZE + pagedRows.length} of {filteredRows.length}
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={pageSafe <= 1}
            className="rounded-md border border-slate-300 px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <span>Page {pageSafe} of {totalPages}</span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={pageSafe >= totalPages}
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
                        checked={draftColumns.includes(column.key as EditableColumnKey)}
                        onChange={() => toggleDraftColumn(column.key as EditableColumnKey)}
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
                    const columnKey = column.key as EditableColumnKey;
                    const showLineBefore = dragOverState?.key === columnKey && dragOverState.position === 'before';
                    const showLineAfter = dragOverState?.key === columnKey && dragOverState.position === 'after';

                    return (
                      <div key={column.key} className="space-y-2">
                        {showLineBefore ? <div className="h-0 border-t-2 border-blue-600" /> : null}
                        <div
                          draggable
                          onDragStart={() => setDraggingColumn(columnKey)}
                          onDragEnd={() => {
                            setDraggingColumn(null);
                            setDragOverState(null);
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            const rect = event.currentTarget.getBoundingClientRect();
                            const midPoint = rect.top + rect.height / 2;
                            const position = event.clientY < midPoint ? 'before' : 'after';
                            setDragOverState({ key: columnKey, position });
                          }}
                          onDragLeave={() => {
                            setDragOverState((current) => (current?.key === columnKey ? null : current));
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (!draggingColumn) return;
                            const position = dragOverState?.key === columnKey ? dragOverState.position : 'after';
                            moveDraftColumn(draggingColumn, columnKey, position);
                            setDraggingColumn(null);
                            setDragOverState(null);
                          }}
                          className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                            draggingColumn === columnKey
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
                            onClick={() => toggleDraftColumn(columnKey)}
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

      {coverTargetRow ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setCoverTargetRow(null)}>
          <div
            className="w-full max-w-xl rounded-md border border-slate-300 bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Mark suggestion as covered episode"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Mark as covered episode</h2>
              <button
                type="button"
                onClick={() => setCoverTargetRow(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <svg aria-hidden="true" viewBox="0 0 12 12" className="h-3.5 w-3.5 stroke-current" fill="none" strokeWidth="1.8">
                  <path d="M2 2l8 8M10 2 2 10" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 p-5">
              <p className="text-sm text-slate-700">
                Suggestion: <span className="font-semibold text-slate-900">{coverTargetRow.title}</span>
              </p>
              <input
                value={episodeQuery}
                onChange={(event) => setEpisodeQuery(event.target.value)}
                placeholder="Search episodes by title or slug"
                className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              />
              <div className="max-h-72 overflow-y-auto rounded-md border border-slate-200">
                {episodeLoading ? (
                  <p className="px-3 py-2 text-xs text-slate-500">Searching episodes...</p>
                ) : episodeOptions.length ? (
                  <ul className="divide-y divide-slate-100">
                    {episodeOptions.map((episode) => (
                      <li key={episode.id}>
                        <label className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-slate-50">
                          <input
                            type="radio"
                            name="freaky-covered-episode"
                            checked={selectedEpisodeId === episode.id}
                            onChange={() => setSelectedEpisodeId(episode.id)}
                            className="mt-0.5"
                          />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-slate-800">{episode.title}</span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-3 py-2 text-xs text-slate-500">No episodes found.</p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
              <button
                type="button"
                onClick={() => setCoverTargetRow(null)}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmCoverSuggestion()}
                disabled={!selectedEpisodeId || Boolean(busyKey)}
                className="inline-flex h-9 items-center justify-center rounded-md bg-blue-600 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark covered
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
