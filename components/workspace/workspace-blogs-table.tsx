'use client';

import { type MouseEvent as ReactMouseEvent, type ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { listBlogPostsAdmin } from '@/lib/blog/data';

type WorkspaceBlogPost = Awaited<ReturnType<typeof listBlogPostsAdmin>>['items'][number];

type SortMode = 'newest' | 'oldest' | 'title';

type ColumnKey =
  | 'id'
  | 'title'
  | 'slug'
  | 'status'
  | 'author'
  | 'primaryCategory'
  | 'publishedAt'
  | 'updatedAt'
  | 'isFeatured'
  | 'excerpt'
  | 'readingTime'
  | 'tags'
  | 'seoScore'
  | 'linkedEpisodes'
  | 'edit';

type ColumnDefinition = {
  key: ColumnKey;
  label: string;
  width: number;
  headClassName?: string;
  cellClassName?: string;
  render: (post: WorkspaceBlogPost) => ReactNode;
};

const PAGE_SIZE = 25;
const WORKSPACE_BLOGS_COLUMNS_KEY = 'workspace_blogs_visible_columns';
const MIN_COLUMN_WIDTH = 80;
const MAX_COLUMN_WIDTH = 1200;
const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
  'title',
  'slug',
  'status',
  'author',
  'primaryCategory',
  'publishedAt'
];

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function getPrimaryDate(post: WorkspaceBlogPost): string | null {
  return post.published_at || post.scheduled_at || post.updated_at || null;
}

function toDateMs(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function compactValue(value: string, maxLength = 90): string {
  const normalized = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (!normalized) return '-';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function StatusPill({ status }: { status: string }) {
  const tones: Record<string, string> = {
    published: 'bg-emerald-100 text-emerald-800',
    draft: 'bg-stone-200 text-stone-700',
    scheduled: 'bg-amber-100 text-amber-800',
    archived: 'bg-slate-200 text-slate-700'
  };

  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide ${tones[status] || tones.draft}`}>
      {status}
    </span>
  );
}

const ALL_COLUMNS: ColumnDefinition[] = [
  {
    key: 'title',
    label: 'Title',
    width: 420,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'text-slate-700',
    render: (post) => (
      <p className="font-medium leading-snug text-slate-900 transition-colors group-hover:text-sky-700">
        {post.title}
      </p>
    )
  },
  {
    key: 'slug',
    label: 'Slug',
    width: 280,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap font-mono text-xs text-slate-700',
    render: (post) => <span title={post.slug}>{compactValue(post.slug, 42)}</span>
  },
  {
    key: 'status',
    label: 'Status',
    width: 130,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (post) => <StatusPill status={post.status} />
  },
  {
    key: 'author',
    label: 'Author',
    width: 180,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (post) => post.author?.name || '-'
  },
  {
    key: 'primaryCategory',
    label: 'Category',
    width: 180,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (post) => post.taxonomies?.categories?.[0]?.name || '-'
  },
  {
    key: 'publishedAt',
    label: 'Published',
    width: 160,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (post) => formatDate(post.published_at || post.scheduled_at)
  },
  {
    key: 'updatedAt',
    label: 'Updated',
    width: 160,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (post) => formatDate(post.updated_at)
  },
  {
    key: 'isFeatured',
    label: 'Featured',
    width: 110,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (post) =>
      post.is_featured ? (
        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">
          Yes
        </span>
      ) : (
        '-'
      )
  },
  {
    key: 'excerpt',
    label: 'Excerpt',
    width: 420,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'text-slate-700',
    render: (post) => (
      <span title={post.excerpt || post.excerpt_auto || ''}>
        {compactValue(post.excerpt || post.excerpt_auto || '-', 120)}
      </span>
    )
  },
  {
    key: 'readingTime',
    label: 'Read Time',
    width: 120,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (post) => (post.reading_time_minutes ? `${post.reading_time_minutes} min` : '-')
  },
  {
    key: 'tags',
    label: 'Tags',
    width: 260,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'text-slate-700',
    render: (post) => {
      const names = post.taxonomies?.tags?.map((tag) => tag.name) ?? [];
      if (!names.length) return '-';
      return <span title={names.join(', ')}>{compactValue(names.join(', '), 60)}</span>;
    }
  },
  {
    key: 'id',
    label: 'ID',
    width: 260,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (post) => <span title={post.id}>{compactValue(post.id, 36)}</span>
  },
  {
    key: 'seoScore',
    label: 'SEO Score',
    width: 120,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (post) => (post.seo_score != null ? post.seo_score : '-')
  },
  {
    key: 'linkedEpisodes',
    label: 'Episodes',
    width: 120,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (post) => {
      const count = post.linked_episodes?.length ?? 0;
      return count > 0 ? count : '-';
    }
  },
  {
    key: 'edit',
    label: 'Edit',
    width: 100,
    headClassName: 'whitespace-nowrap',
    cellClassName: 'whitespace-nowrap text-slate-700',
    render: (post) => (
      <span
        className="inline-flex text-sky-700 hover:underline"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <a href={`/workspace/dashboard/blogs/${post.id}`}>Open</a>
      </span>
    )
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
      WORKSPACE_BLOGS_COLUMNS_KEY,
      JSON.stringify({
        columns,
        widths
      })
    );
  } catch {
    // Ignore storage write failures in restricted browser contexts.
  }
}

export function WorkspaceBlogsTable({ posts }: { posts: WorkspaceBlogPost[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [yearFilter, setYearFilter] = useState('all');
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
      const raw = window.localStorage.getItem(WORKSPACE_BLOGS_COLUMNS_KEY);
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

  const years = useMemo(() => {
    const uniqueYears = new Set<string>();

    posts.forEach((post) => {
      const raw = getPrimaryDate(post);
      if (!raw) return;
      const date = new Date(raw);
      if (Number.isNaN(date.getTime())) return;
      uniqueYears.add(`${date.getUTCFullYear()}`);
    });

    return Array.from(uniqueYears).sort((a, b) => Number(b) - Number(a));
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const filtered = posts.filter((post) => {
      if (yearFilter !== 'all') {
        const raw = getPrimaryDate(post);
        if (!raw) return false;
        const publishedDate = new Date(raw);
        if (Number.isNaN(publishedDate.getTime())) return false;
        if (`${publishedDate.getUTCFullYear()}` !== yearFilter) return false;
      }

      if (!normalizedQuery) return true;

      return (
        post.title.toLowerCase().includes(normalizedQuery) ||
        post.slug.toLowerCase().includes(normalizedQuery)
      );
    });

    const sorted = [...filtered];

    if (sortMode === 'title') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      return sorted;
    }

    sorted.sort((a, b) => {
      if (sortMode === 'oldest') return toDateMs(getPrimaryDate(a)) - toDateMs(getPrimaryDate(b));
      return toDateMs(getPrimaryDate(b)) - toDateMs(getPrimaryDate(a));
    });

    return sorted;
  }, [posts, query, sortMode, yearFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, yearFilter, sortMode]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const pagedPosts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredPosts.slice(start, start + PAGE_SIZE);
  }, [filteredPosts, page]);

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

  if (!posts.length) {
    return (
      <div className="rounded-md border border-slate-300 bg-white p-6 text-sm text-slate-700">
        No blog posts found.
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
                placeholder="Title or slug"
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
            <span>Year</span>
            <span className="relative inline-block">
              <select
                value={yearFilter}
                onChange={(event) => setYearFilter(event.target.value)}
                className="h-8 w-auto min-w-[8rem] appearance-none rounded-md border border-slate-300 px-2 py-1 pr-7 text-xs"
              >
                <option value="all">All years</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
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
            {pagedPosts.map((post) => {
              const detailHref = `/workspace/dashboard/blogs/${post.id}`;

              return (
                <tr
                  key={post.id}
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
                    <td key={`${post.id}:${column.key}`} className={`align-middle px-3 py-2 ${column.cellClassName || 'text-slate-700'}`}>
                      {column.render(post)}
                    </td>
                  ))}
                </tr>
              );
            })}

            {!pagedPosts.length ? (
              <tr>
                <td colSpan={visibleColumnDefinitions.length} className="px-3 py-8 text-center text-sm text-slate-600">
                  No blog posts match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
        <p>
          Showing {(page - 1) * PAGE_SIZE + (pagedPosts.length ? 1 : 0)}-{(page - 1) * PAGE_SIZE + pagedPosts.length} of {filteredPosts.length}
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
