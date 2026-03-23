'use client';

import Image from 'next/image';
import { type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { type PodcastEpisode, formatEpisodeDate } from '@/lib/podcast-shared';
import { type PrepublishDraftStatus } from '@/lib/episode-prepublish-drafts';

type WorkspaceDraftListRow = {
  rowType: 'prepublish_draft';
  id: string;
  title: string;
  normalizedTitle: string;
  status: PrepublishDraftStatus;
  reviewReason: string | null;
  matchedEpisodeId: string | null;
  updatedAt: string;
  expectedPublishDate: string | null;
  allowTitleCollision: boolean;
  primaryTopicName?: string | null;
  seoTitle?: string | null;
  metaDescription?: string | null;
  seoScore?: number | null;
  hasTranscript?: boolean;
  artworkUrl?: string | null;
};

type WorkspaceEpisodeTableRow = PodcastEpisode & {
  rowType: 'live_episode' | 'prepublish_draft';
  draftId?: string;
  draftStatus?: PrepublishDraftStatus;
  normalizedTitle?: string;
  reviewReason?: string | null;
  matchedEpisodeId?: string | null;
  expectedPublishDate?: string | null;
  allowTitleCollision?: boolean;
};

type SortDirection = 'asc' | 'desc';
type SortState = { column: ColumnKey; direction: SortDirection };

const SORTABLE_COLUMNS = new Set<ColumnKey>([
  'title',
  'rowStatus',
  'episodeNumber',
  'publishedAt',
  'duration',
  'seasonNumber',
  'primaryTopic',
  'seoTitleLen',
  'metaDescLen',
  'seoScore',
  'hasTranscript'
]);

function getSortValue(episode: WorkspaceEpisodeTableRow, column: ColumnKey): string | number {
  switch (column) {
    case 'rowStatus': return episode.rowType === 'prepublish_draft' ? (episode.draftStatus || '') : 'live_episode';
    case 'title': return episode.title.toLowerCase();
    case 'episodeNumber': return episode.episodeNumber ?? -1;
    case 'publishedAt': return toDateMs(episode.publishedAt);
    case 'duration': return episode.duration || '';
    case 'seasonNumber': return episode.seasonNumber ?? -1;
    case 'primaryTopic': return (episode.primaryTopicName || '').toLowerCase();
    case 'seoTitleLen': return (episode.seoTitle || '').trim().length;
    case 'metaDescLen': return (episode.metaDescription || '').trim().length;
    case 'seoScore': return episode.seoScore ?? 0;
    case 'hasTranscript': return episode.hasTranscript ? 1 : 0;
    default: return 0;
  }
}

type ColumnKey =
  | 'rowStatus'
  | 'id'
  | 'slug'
  | 'title'
  | 'seasonNumber'
  | 'episodeNumber'
  | 'publishedAt'
  | 'duration'
  | 'artworkUrl'
  | 'audioUrl'
  | 'sourceUrl'
  | 'description'
  | 'descriptionHtml'
  | 'primaryTopic'
  | 'seoTitleLen'
  | 'metaDescLen'
  | 'seoScore'
  | 'hasTranscript'
  | 'actions';

type EditableColumnKey = Exclude<ColumnKey, 'actions'>;

type ColumnDefinition = {
  key: ColumnKey;
  label: string;
  width: number;
  headClassName?: string;
  cellClassName?: string;
  render: (episode: WorkspaceEpisodeTableRow) => ReactNode;
};
type EditableColumnDefinition = Omit<ColumnDefinition, 'key'> & { key: EditableColumnKey };

const PAGE_SIZE = 25;
const WORKSPACE_EPISODES_COLUMNS_KEY = 'workspace_episodes_visible_columns';
const WORKSPACE_EPISODES_PAGE_KEY = 'workspace_episodes_page';
const WORKSPACE_EPISODES_FILTERS_KEY = 'workspace_episodes_filters_v1';
const MIN_COLUMN_WIDTH = 80;
const MAX_COLUMN_WIDTH = 1200;
const FIXED_COLUMN: ColumnKey = 'actions';
const ACTIONS_COLUMN_WIDTH = 132;
const DEFAULT_VISIBLE_COLUMNS: EditableColumnKey[] = [
  'rowStatus',
  'artworkUrl',
  'episodeNumber',
  'title',
  'publishedAt',
  'duration',
  'audioUrl'
];

function toDateMs(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compactValue(value: string, maxLength = 90): string {
  const normalized = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (!normalized) return '-';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

const ALL_COLUMNS: ColumnDefinition[] = [
  {
    key: 'rowStatus',
    label: 'Type',
    width: 180,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap',
    render: (episode) => {
      if (episode.rowType === 'live_episode') {
        return (
          <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase text-emerald-800">
            Live
          </span>
        );
      }

      const status = episode.draftStatus || 'draft';
      const statusTone: Record<PrepublishDraftStatus, string> = {
        draft: 'bg-slate-100 text-slate-700',
        ready_to_match: 'bg-blue-100 text-blue-800',
        needs_review: 'bg-amber-100 text-amber-800',
        conflict: 'bg-rose-100 text-rose-800',
        attached: 'bg-emerald-100 text-emerald-800',
        archived: 'bg-slate-200 text-slate-700'
      };
      return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase ${statusTone[status]}`}>
          {status.replaceAll('_', ' ')}
        </span>
      );
    }
  },
  {
    key: 'title',
    label: 'Title',
    width: 420,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'text-slate-700',
    render: (episode) => (
      <p className="font-medium leading-snug text-slate-900 transition-colors group-hover:text-sky-700">
        {episode.title}
      </p>
    )
  },
  {
    key: 'episodeNumber',
    label: 'Episode #',
    width: 120,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (episode) => episode.episodeNumber ?? '-'
  },
  {
    key: 'publishedAt',
    label: 'Published',
    width: 190,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (episode) => formatEpisodeDate(episode.publishedAt)
  },
  {
    key: 'duration',
    label: 'Duration',
    width: 130,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (episode) => episode.duration || '-'
  },
  {
    key: 'artworkUrl',
    label: 'Artwork',
    width: 120,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (episode) =>
      episode.artworkUrl ? (
        <span className="inline-flex h-10 w-10 overflow-hidden rounded border border-slate-200 bg-slate-100">
          <Image
            src={episode.artworkUrl}
            alt={`Artwork for ${episode.title}`}
            width={40}
            height={40}
            className="h-full w-full object-cover"
            unoptimized
          />
        </span>
      ) : (
        '-'
      )
  },
  {
    key: 'audioUrl',
    label: 'Audio',
    width: 240,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (episode) => episode.audioUrl ? (
      <span
        className="inline-flex"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <audio controls preload="none" className="h-8 w-52">
          <source src={episode.audioUrl} />
        </audio>
      </span>
    ) : (
      <span className="text-slate-400">&ndash;</span>
    )
  },
  {
    key: 'seasonNumber',
    label: 'Season #',
    width: 120,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (episode) => episode.seasonNumber ?? '-'
  },
  {
    key: 'sourceUrl',
    label: 'Source URL',
    width: 360,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap font-mono text-xs text-slate-700',
    render: (episode) => <span title={episode.sourceUrl || ''}>{compactValue(episode.sourceUrl || '-', 52)}</span>
  },
  {
    key: 'id',
    label: 'ID',
    width: 260,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (episode) => <span title={episode.id}>{compactValue(episode.id, 36)}</span>
  },
  {
    key: 'slug',
    label: 'Slug',
    width: 280,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (episode) => <span title={episode.slug}>{compactValue(episode.slug, 42)}</span>
  },
  {
    key: 'description',
    label: 'Description',
    width: 520,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'text-slate-700',
    render: (episode) => <span title={episode.description}>{compactValue(episode.description, 120)}</span>
  },
  {
    key: 'descriptionHtml',
    label: 'Description HTML',
    width: 520,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'text-slate-700',
    render: (episode) => <span title={episode.descriptionHtml}>{compactValue(episode.descriptionHtml, 120)}</span>
  },
  {
    key: 'primaryTopic',
    label: 'Primary Topic',
    width: 180,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (episode) => episode.primaryTopicName ? <span title={episode.primaryTopicName}>{compactValue(episode.primaryTopicName, 28)}</span> : <span className="text-slate-400">&ndash;</span>
  },
  {
    key: 'seoTitleLen',
    label: 'SEO Title Len',
    width: 130,
    headClassName: 'whitespace-nowrap text-center',
    cellClassName: 'whitespace-nowrap text-center text-slate-700',
    render: (episode) => {
      const val = (episode.seoTitle || '').trim();
      if (!val) return <span className="text-slate-400">&ndash;</span>;
      const len = val.length;
      const color = len >= 50 && len <= 60 ? 'text-emerald-600' : 'text-amber-600';
      return <span className={color}>{len}</span>;
    }
  },
  {
    key: 'metaDescLen',
    label: 'Meta Desc Len',
    width: 140,
    headClassName: 'whitespace-nowrap text-center',
    cellClassName: 'whitespace-nowrap text-center text-slate-700',
    render: (episode) => {
      const val = (episode.metaDescription || '').trim();
      if (!val) return <span className="text-slate-400">&ndash;</span>;
      const len = val.length;
      const color = len >= 140 && len <= 158 ? 'text-emerald-600' : 'text-amber-600';
      return <span className={color}>{len}</span>;
    }
  },
  {
    key: 'seoScore',
    label: 'SEO Score',
    width: 120,
    headClassName: 'whitespace-nowrap text-center',
    cellClassName: 'whitespace-nowrap text-center text-slate-700',
    render: (episode) => {
      const score = episode.seoScore ?? 0;
      const color = score >= 80 ? 'text-emerald-600' : score >= 40 ? 'text-amber-600' : 'text-rose-600';
      return <span className={`font-medium ${color}`}>{score}</span>;
    }
  },
  {
    key: 'hasTranscript',
    label: 'Transcript',
    width: 110,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-center text-slate-700',
    render: (episode) => episode.hasTranscript ? <span className="text-emerald-600">✓</span> : <span className="text-slate-400">&ndash;</span>
  },
  {
    key: 'actions',
    label: 'Actions',
    width: ACTIONS_COLUMN_WIDTH,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (episode) => (
      episode.rowType === 'live_episode' ? (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            window.open(`/episodes/${episode.slug}`, '_blank', 'noopener,noreferrer');
          }}
          onMouseDown={(event) => event.stopPropagation()}
          className="inline-flex h-7 items-center justify-center rounded-md border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          View
        </button>
      ) : (
        <span className="text-xs text-slate-400">Draft only</span>
      )
    )
  }
];

const COLUMN_BY_KEY = new Map(ALL_COLUMNS.map((column) => [column.key, column]));
const EDITABLE_COLUMNS: EditableColumnDefinition[] = ALL_COLUMNS.filter(
  (column): column is EditableColumnDefinition => column.key !== FIXED_COLUMN
);
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

  // Remove duplicates while keeping first-seen order.
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

function toPersistedSort(value: unknown): SortState | null {
  if (!value || typeof value !== 'object') return null;
  const { column, direction } = value as Record<string, unknown>;
  if (typeof column !== 'string' || typeof direction !== 'string') return null;
  if (!SORTABLE_COLUMNS.has(column as ColumnKey)) return null;
  if (direction !== 'asc' && direction !== 'desc') return null;
  return { column: column as ColumnKey, direction: direction as SortDirection };
}

function toPersistedQuery(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toPersistedRowType(value: unknown): 'all' | 'live_episode' | 'prepublish_draft' | null {
  const normalized = `${value || ''}`;
  if (normalized === 'all' || normalized === 'live_episode' || normalized === 'prepublish_draft') return normalized;
  return null;
}

function toPersistedDraftStatus(value: unknown): 'all' | PrepublishDraftStatus | null {
  const normalized = `${value || ''}`;
  if (normalized === 'all') return 'all';
  if (normalized === 'draft' || normalized === 'ready_to_match' || normalized === 'needs_review' || normalized === 'conflict' || normalized === 'attached' || normalized === 'archived') {
    return normalized;
  }
  return null;
}

function persistTableConfig(columns: EditableColumnKey[], widths: Record<ColumnKey, number>, sort: SortState) {
  try {
    window.localStorage.setItem(
      WORKSPACE_EPISODES_COLUMNS_KEY,
      JSON.stringify({
        columns,
        widths,
        sort
      })
    );
  } catch {
    // Ignore storage write failures in restricted browser contexts.
  }
}

export function WorkspaceEpisodesTable({
  episodes,
  draftRows
}: {
  episodes: PodcastEpisode[];
  draftRows: WorkspaceDraftListRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [rowTypeFilter, setRowTypeFilter] = useState<'all' | 'live_episode' | 'prepublish_draft'>('all');
  const [draftStatusFilter, setDraftStatusFilter] = useState<'all' | PrepublishDraftStatus>('all');
  const [sort, setSort] = useState<SortState>({ column: 'publishedAt', direction: 'desc' });
  const [page, setPageRaw] = useState(1);

  const setPage = (next: number | ((prev: number) => number)) => {
    setPageRaw((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      try { window.sessionStorage.setItem(WORKSPACE_EPISODES_PAGE_KEY, String(resolved)); } catch {}
      return resolved;
    });
  };
  const [visibleColumns, setVisibleColumns] = useState<EditableColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
  const [columnWidths, setColumnWidths] = useState<Record<ColumnKey, number>>(DEFAULT_COLUMN_WIDTHS);
  const [columnEditorOpen, setColumnEditorOpen] = useState(false);
  const [columnSearch, setColumnSearch] = useState('');
  const [draftColumns, setDraftColumns] = useState<EditableColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
  const [draggingColumn, setDraggingColumn] = useState<EditableColumnKey | null>(null);
  const [dragOverState, setDragOverState] = useState<{ key: EditableColumnKey; position: 'before' | 'after' } | null>(null);
  const [resizing, setResizing] = useState<{ key: ColumnKey; startX: number; startWidth: number } | null>(null);
  const [configRestored, setConfigRestored] = useState(false);
  const widthsRef = useRef(columnWidths);
  const columnsRef = useRef(visibleColumns);

  useLayoutEffect(() => {
    try {
      const storedPage = window.sessionStorage.getItem(WORKSPACE_EPISODES_PAGE_KEY);
      if (storedPage) {
        const parsed = Number(storedPage);
        if (parsed >= 1) setPageRaw(parsed);
      }
    } catch {}

    try {
      const raw = window.localStorage.getItem(WORKSPACE_EPISODES_COLUMNS_KEY);
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
      const restoredSort = toPersistedSort((parsed as { sort?: unknown }).sort);

      if (restoredColumns.length) {
        setVisibleColumns(restoredColumns);
        setDraftColumns(restoredColumns);
      }
      setColumnWidths(toColumnWidths(restoredWidths));
      if (restoredSort) setSort(restoredSort);
    } catch {
      // Ignore storage parse errors and keep defaults.
    } finally {
      setConfigRestored(true);
    }

    try {
      const rawFilters = window.localStorage.getItem(WORKSPACE_EPISODES_FILTERS_KEY);
      if (!rawFilters) return;
      const parsed = JSON.parse(rawFilters) as {
        query?: unknown;
        rowTypeFilter?: unknown;
        draftStatusFilter?: unknown;
      };
      const restoredQuery = toPersistedQuery(parsed.query);
      const restoredRowType = toPersistedRowType(parsed.rowTypeFilter);
      const restoredDraftStatus = toPersistedDraftStatus(parsed.draftStatusFilter);
      if (restoredQuery !== null) setQuery(restoredQuery);
      if (restoredRowType) setRowTypeFilter(restoredRowType);
      if (restoredDraftStatus) setDraftStatusFilter(restoredDraftStatus);
    } catch {
      // Ignore storage parse errors and keep defaults.
    }
  }, []);

  useEffect(() => {
    if (!configRestored) return;
    persistTableConfig(visibleColumns, columnWidths, sort);
  }, [visibleColumns, columnWidths, sort, configRestored]);

  useEffect(() => {
    if (!configRestored) return;
    try {
      window.localStorage.setItem(
        WORKSPACE_EPISODES_FILTERS_KEY,
        JSON.stringify({
          query,
          rowTypeFilter,
          draftStatusFilter
        })
      );
    } catch {
      // Ignore storage write failures in restricted browser contexts.
    }
  }, [query, rowTypeFilter, draftStatusFilter, configRestored]);

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
      persistTableConfig(columnsRef.current, widthsRef.current, sort);
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
  }, [resizing, sort]);

  const tableRows = useMemo<WorkspaceEpisodeTableRow[]>(() => {
    const liveRows: WorkspaceEpisodeTableRow[] = episodes.map((episode) => ({
      ...episode,
      rowType: 'live_episode'
    }));

    const draftMappedRows: WorkspaceEpisodeTableRow[] = draftRows.map((draft) => ({
      id: draft.id,
      slug: '',
      title: draft.title,
      seasonNumber: null,
      episodeNumber: null,
      publishedAt: draft.expectedPublishDate || draft.updatedAt,
      description: '',
      descriptionHtml: '',
      audioUrl: '',
      artworkUrl: draft.artworkUrl || null,
      duration: null,
      sourceUrl: null,
      primaryTopicName: draft.primaryTopicName || null,
      seoTitle: draft.seoTitle || null,
      metaDescription: draft.metaDescription || null,
      seoScore: draft.seoScore ?? null,
      hasTranscript: draft.hasTranscript === true,
      rowType: 'prepublish_draft',
      draftId: draft.id,
      draftStatus: draft.status,
      normalizedTitle: draft.normalizedTitle,
      reviewReason: draft.reviewReason,
      matchedEpisodeId: draft.matchedEpisodeId,
      expectedPublishDate: draft.expectedPublishDate,
      allowTitleCollision: draft.allowTitleCollision
    }));

    return [...liveRows, ...draftMappedRows];
  }, [episodes, draftRows]);

  const filteredEpisodes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = tableRows.filter((episode) => {
      if (rowTypeFilter !== 'all' && episode.rowType !== rowTypeFilter) {
        return false;
      }

      if (draftStatusFilter !== 'all') {
        if (episode.rowType !== 'prepublish_draft') return false;
        if ((episode.draftStatus || 'draft') !== draftStatusFilter) return false;
      }

      if (!normalizedQuery) return true;

      return (
        episode.title.toLowerCase().includes(normalizedQuery) ||
        (episode.slug || '').toLowerCase().includes(normalizedQuery) ||
        `${episode.episodeNumber ?? ''}`.includes(normalizedQuery) ||
        (episode.normalizedTitle || '').toLowerCase().includes(normalizedQuery)
      );
    });

    const sorted = [...filtered];
    const { column, direction } = sort;
    const multiplier = direction === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
      const aVal = getSortValue(a, column);
      const bVal = getSortValue(b, column);
      if (typeof aVal === 'string' && typeof bVal === 'string') return multiplier * aVal.localeCompare(bVal);
      return multiplier * ((aVal as number) - (bVal as number));
    });

    return sorted;
  }, [tableRows, query, sort, rowTypeFilter, draftStatusFilter]);



  const totalPages = Math.max(1, Math.ceil(filteredEpisodes.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedEpisodes = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredEpisodes.slice(start, start + PAGE_SIZE);
  }, [filteredEpisodes, page]);

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
    persistTableConfig(normalized, columnWidths, sort);
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

  if (!tableRows.length) {
    return (
      <div className="rounded-md border border-slate-300 bg-white p-6 text-sm text-slate-700">
        No episodes or prepublish drafts are available.
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
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                placeholder="Title, slug, normalized title, or episode #"
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
          </div>

          <label className="flex flex-col gap-1 text-xs font-medium text-slate-700">
            <span>Row Type</span>
            <span className="relative inline-block">
              <select
                value={rowTypeFilter}
                onChange={(event) => {
                  setRowTypeFilter(event.target.value as 'all' | 'live_episode' | 'prepublish_draft');
                  setPage(1);
                }}
                className="h-8 w-auto min-w-[10rem] appearance-none rounded-md border border-slate-300 px-2 py-1 pr-7 text-xs"
              >
                <option value="all">All rows</option>
                <option value="live_episode">Live episodes</option>
                <option value="prepublish_draft">Prepublish drafts</option>
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
            <span>Draft Status</span>
            <span className="relative inline-block">
              <select
                value={draftStatusFilter}
                onChange={(event) => {
                  setDraftStatusFilter(event.target.value as 'all' | PrepublishDraftStatus);
                  setPage(1);
                }}
                className="h-8 w-auto min-w-[11rem] appearance-none rounded-md border border-slate-300 px-2 py-1 pr-7 text-xs"
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="ready_to_match">Ready to match</option>
                <option value="needs_review">Needs review</option>
                <option value="conflict">Conflict</option>
                <option value="attached">Attached</option>
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
                    className={`relative border-l border-slate-300 py-2 font-semibold ${column.headClassName || ''} ${isFixed ? 'sticky right-0 z-20 bg-slate-100 px-2 text-left shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.25)]' : 'px-3'} ${SORTABLE_COLUMNS.has(column.key) ? 'cursor-pointer select-none' : ''}`}
                    style={{ borderLeftWidth: '0.5px' }}
                    onClick={SORTABLE_COLUMNS.has(column.key) ? () => {
                      setSort((prev) => prev.column === column.key
                        ? { column: column.key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                        : { column: column.key, direction: 'asc' }
                      );
                      setPage(1);
                    } : undefined}
                  >
                  <span className="inline-flex items-center gap-1 pr-2">
                    {column.label}
                    {SORTABLE_COLUMNS.has(column.key) ? (
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
            {pagedEpisodes.map((episode) => {
              const detailHref = episode.rowType === 'prepublish_draft'
                ? `/workspace/dashboard/episodes/drafts/${episode.id}`
                : `/workspace/dashboard/episodes/${episode.slug}`;

              return (
                <tr
                  key={episode.id}
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
                  {renderedColumnDefinitions.map((column) => {
                    const isFixed = column.key === FIXED_COLUMN;
                    return (
                      <td
                        key={`${episode.id}:${column.key}`}
                        className={`align-middle py-2 ${column.cellClassName || 'text-slate-700'} ${isFixed ? 'sticky right-0 z-10 bg-white px-2 shadow-[-8px_0_8px_-8px_rgba(15,23,42,0.2)] group-hover:bg-sky-50' : 'px-3'}`}
                      >
                        {column.render(episode)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {!pagedEpisodes.length ? (
              <tr>
                <td colSpan={renderedColumnDefinitions.length} className="px-3 py-8 text-center text-sm text-slate-600">
                  No episodes match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
        <p>
          Showing {(page - 1) * PAGE_SIZE + (pagedEpisodes.length ? 1 : 0)}-{(page - 1) * PAGE_SIZE + pagedEpisodes.length} of {filteredEpisodes.length}
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
    </section>
  );
}
