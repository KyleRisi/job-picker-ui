'use client';

import { Fragment, type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { REDIRECT_MATCH_TYPES, REDIRECT_STATUS_CODES } from '@/lib/redirects';

type RedirectItem = {
  id: string;
  source_path: string;
  target_url: string;
  status_code: 301 | 302 | 307 | 308;
  match_type: 'exact' | 'prefix';
  is_active: boolean;
  priority: number;
  notes: string;
  created_at: string;
  updated_at: string;
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

const EMPTY_FORM: FormState = {
  source_path: '',
  target_url: '',
  status_code: '301',
  match_type: 'exact',
  is_active: true,
  priority: '100',
  notes: ''
};

export function AdminRedirectsForm({
  onTotalChange,
  panelMode = 'none',
  onClosePanel,
  onOpenCreatePanel
}: {
  onTotalChange?: (count: number) => void;
  panelMode?: 'none' | 'create' | 'import';
  onClosePanel?: () => void;
  onOpenCreatePanel?: () => void;
} = {}) {
  const [items, setItems] = useState<RedirectItem[]>([]);
  const [query, setQuery] = useState('');
  const [statusCodeFilter, setStatusCodeFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'upsert' | 'replace'>('upsert');
  const [isImporting, setIsImporting] = useState(false);
  const [openActionsId, setOpenActionsId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: `${page}` });
    if (query.trim()) params.set('q', query.trim());
    if (statusCodeFilter) params.set('status_code', statusCodeFilter);
    if (activeFilter) params.set('is_active', activeFilter);
    return params.toString();
  }, [activeFilter, page, query, statusCodeFilter]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/redirects?${queryString}`, { cache: 'no-store' });
      const data = (await res.json()) as RedirectsResponse | { error?: string };
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Failed to load redirects.');
      }

      const payload = data as RedirectsResponse;
      setItems(payload.items || []);
      setTotalPages(payload.pagination?.totalPages || 1);
      onTotalChange?.(payload.pagination?.total || 0);
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Failed to load redirects.';
      setError(nextError);
      onTotalChange?.(0);
    } finally {
      setIsLoading(false);
    }
  }, [onTotalChange, queryString]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        source_path: form.source_path,
        target_url: form.target_url,
        status_code: Number.parseInt(form.status_code, 10),
        match_type: form.match_type,
        is_active: form.is_active,
        priority: Number.parseInt(form.priority || '100', 10),
        notes: form.notes
      };

      const endpoint = editingId ? `/api/admin/redirects/${editingId}` : '/api/admin/redirects';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save redirect.');

      setMessage(editingId ? 'Redirect updated.' : 'Redirect created.');
      resetForm();
      setPage(1);
      onClosePanel?.();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save redirect.');
    } finally {
      setIsSaving(false);
    }
  }

  function startEdit(item: RedirectItem) {
    onOpenCreatePanel?.();
    setEditingId(item.id);
    setForm({
      source_path: item.source_path,
      target_url: item.target_url,
      status_code: `${item.status_code}` as FormState['status_code'],
      match_type: item.match_type,
      is_active: item.is_active,
      priority: `${item.priority}`,
      notes: item.notes || ''
    });
    setMessage('');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deleteRow(id: string) {
    const shouldDelete = window.confirm('Delete this redirect? This cannot be undone.');
    if (!shouldDelete) return;

    setError('');
    setMessage('');

    const res = await fetch(`/api/admin/redirects/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || 'Failed to delete redirect.');
      return;
    }

    setMessage('Redirect deleted.');
    await load();
  }

  async function toggleItemActive(item: RedirectItem, nextActive: boolean) {
    setError('');
    setMessage('');

    const res = await fetch(`/api/admin/redirects/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source_path: item.source_path,
        target_url: item.target_url,
        status_code: item.status_code,
        match_type: item.match_type,
        is_active: nextActive,
        priority: item.priority,
        notes: item.notes || ''
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || 'Failed to update redirect.');
      return;
    }

    setMessage(nextActive ? 'Redirect enabled.' : 'Redirect disabled.');
    await load();
  }

  async function importCsv(file: File) {
    setIsImporting(true);
    setError('');
    setMessage('');

    try {
      const csv = await file.text();
      const res = await fetch('/api/admin/redirects/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv, mode: importMode })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to import CSV.');

      setMessage(data?.message || 'Import complete.');
      setPage(1);
      onClosePanel?.();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import CSV.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-4">
      {panelMode === 'create' ? (
        <form onSubmit={submitForm} className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">{editingId ? 'Edit Redirect' : 'Add Redirect'}</h2>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                resetForm();
                onClosePanel?.();
              }}
            >
              Close
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="label">
              Source path
              <input
                className="input mt-1"
                placeholder="/old-page"
                value={form.source_path}
                onChange={(event) => setForm((prev) => ({ ...prev, source_path: event.target.value }))}
                required
              />
            </label>

            <label className="label">
              Target URL
              <input
                className="input mt-1"
                placeholder="/new-page or https://example.com/page"
                value={form.target_url}
                onChange={(event) => setForm((prev) => ({ ...prev, target_url: event.target.value }))}
                required
              />
            </label>

            <label className="label">
              Match type
              <select
                className="input mt-1"
                value={form.match_type}
                onChange={(event) => setForm((prev) => ({ ...prev, match_type: event.target.value as 'exact' | 'prefix' }))}
              >
                {REDIRECT_MATCH_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="label">
              Status code
              <select
                className="input mt-1"
                value={form.status_code}
                onChange={(event) => setForm((prev) => ({ ...prev, status_code: event.target.value as FormState['status_code'] }))}
              >
                {REDIRECT_STATUS_CODES.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </label>

            <label className="label">
              Priority
              <input
                className="input mt-1"
                type="number"
                min={0}
                value={form.priority}
                onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
                required
              />
            </label>

            <label className="label flex items-center gap-2 pt-7">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              />
              Active
            </label>
          </div>

          <label className="label">
            Notes
            <textarea
              className="input mt-1"
              rows={2}
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Optional notes"
            />
          </label>

          <button type="submit" className="btn-primary" disabled={isSaving}>
            {isSaving ? 'Saving…' : editingId ? 'Update Redirect' : 'Create Redirect'}
          </button>

          {message ? <p className="rounded-md bg-emerald-100 p-3 font-semibold">{message}</p> : null}
          {error ? <p className="rounded-md bg-red-100 p-3 font-semibold text-carnival-red">{error}</p> : null}
        </form>
      ) : null}

      {panelMode === 'import' ? (
        <section className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold">CSV Import Mode</h2>
            <button type="button" className="btn-secondary" onClick={() => onClosePanel?.()}>
              Close
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="label">
              Import mode
              <select
                className="input mt-1"
                value={importMode}
                onChange={(event) => setImportMode(event.target.value as 'upsert' | 'replace')}
              >
                <option value="upsert">Upsert (recommended)</option>
                <option value="replace">Replace all</option>
              </select>
            </label>
            <label className="label">
              Import CSV
              <input
                ref={fileInputRef}
                className="input mt-1"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importCsv(file);
                }}
                disabled={isImporting}
              />
            </label>
          </div>
          <p className="text-sm text-carnival-ink/70">
            CSV headers: source_path,target_url,status_code,match_type,is_active,priority,notes
          </p>
          {message ? <p className="rounded-md bg-emerald-100 p-3 font-semibold">{message}</p> : null}
          {error ? <p className="rounded-md bg-red-100 p-3 font-semibold text-carnival-red">{error}</p> : null}
        </section>
      ) : null}

      <section className="card space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="label">
            Search
            <input
              className="input mt-1"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search source or target"
            />
          </label>

          <label className="label">
            Status code
            <select
              className="input mt-1"
              value={statusCodeFilter}
              onChange={(event) => {
                setStatusCodeFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              {REDIRECT_STATUS_CODES.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>

          <label className="label">
            Active
            <select
              className="input mt-1"
              value={activeFilter}
              onChange={(event) => {
                setActiveFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
        </div>

        <div className="overflow-visible">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Source</th>
                <th className="py-2 pr-3">Target</th>
                <th className="w-0 whitespace-nowrap py-2 pr-0 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const openUp = index >= items.length - 3;

                return (
                <Fragment key={item.id}>
                <tr className="border-b last:border-b-0 align-top">
                  <td className="max-w-[220px] truncate py-2 pr-3 font-semibold" title={item.source_path}>{item.source_path}</td>
                  <td className="max-w-[260px] truncate py-2 pr-3" title={item.target_url}>{item.target_url}</td>
                  <td className="w-0 whitespace-nowrap py-2 pr-0 text-right">
                    <div className={`relative inline-block text-left ${openActionsId === item.id ? 'z-[120]' : ''}`}>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => setOpenActionsId((prev) => (prev === item.id ? null : item.id))}
                        aria-haspopup="menu"
                        aria-expanded={openActionsId === item.id}
                      >
                        Actions
                      </button>

                      {openActionsId === item.id ? (
                        <div
                          className={`absolute right-0 z-[80] w-40 rounded-md border border-carnival-ink/20 bg-white p-1 shadow-card ${
                            openUp ? 'bottom-full mb-2' : 'mt-2'
                          }`}
                          role="menu"
                        >
                          <button
                            type="button"
                            className="block w-full rounded px-3 py-2 text-left hover:bg-carnival-cream"
                            onClick={() => {
                              setOpenActionsId(null);
                              setExpandedId((prev) => (prev === item.id ? null : item.id));
                            }}
                          >
                            {expandedId === item.id ? 'Hide Details' : 'View Details'}
                          </button>
                          <button
                            type="button"
                            className="block w-full rounded px-3 py-2 text-left hover:bg-carnival-cream"
                            onClick={() => {
                              setOpenActionsId(null);
                              startEdit(item);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="block w-full rounded px-3 py-2 text-left hover:bg-carnival-cream"
                            onClick={() => {
                              setOpenActionsId(null);
                              void toggleItemActive(item, !item.is_active);
                            }}
                          >
                            {item.is_active ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            className="block w-full rounded px-3 py-2 text-left hover:bg-carnival-cream"
                            onClick={() => {
                              setOpenActionsId(null);
                              void deleteRow(item.id);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
                {expandedId === item.id ? (
                  <tr className="border-b bg-white/60">
                    <td colSpan={3} className="py-3 pr-3">
                      <div className="grid gap-2 text-sm md:grid-cols-2">
                        <p><span className="font-bold">Match type:</span> {item.match_type.toUpperCase()}</p>
                        <p><span className="font-bold">Status code:</span> {item.status_code}</p>
                        <p><span className="font-bold">Active:</span> {item.is_active ? 'Yes' : 'No'}</p>
                        <p><span className="font-bold">Priority:</span> {item.priority}</p>
                        <p>
                          <span className="font-bold">Updated:</span>{' '}
                          {new Date(item.updated_at).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : null}
                </Fragment>
              );
              })}

              {!items.length && !isLoading ? (
                <tr>
                  <td className="py-4" colSpan={3}>No redirects found for the selected filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Page {page} of {totalPages}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={page <= 1 || isLoading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Previous
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
