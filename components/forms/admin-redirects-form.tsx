'use client';

import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { REDIRECT_MATCH_TYPES, REDIRECT_STATUS_CODES, isSafeTargetUrl } from '@/lib/redirects';

type RedirectItem = {
  id: string;
  source_path: string;
  target_url: string;
  status_code: 301 | 302 | 307 | 308;
  match_type: 'exact' | 'prefix';
  is_active: boolean;
  priority: number;
  notes: string;
  source_type?: string;
  source_ref?: string | null;
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

function validateSourcePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (!trimmed.startsWith('/')) return 'Source path must start with "/".';
  if (/\s/.test(trimmed)) return 'Source path cannot contain spaces.';
  return '';
}

function validateTargetUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (trimmed.startsWith('/')) {
    if (/\s/.test(trimmed)) return 'Internal target paths cannot contain spaces.';
    return '';
  }

  if (!isSafeTargetUrl(trimmed)) {
    return 'Target must be an internal path (starting with "/") or a valid http/https URL.';
  }

  return '';
}

export function AdminRedirectsForm({
  onTotalChange,
  panelMode = 'none',
  onClosePanel
}: {
  onTotalChange?: (count: number) => void;
  panelMode?: 'none' | 'create' | 'import';
  onClosePanel?: () => void;
} = {}) {
  const [items, setItems] = useState<RedirectItem[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isInlineSaving, setIsInlineSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [inlineForm, setInlineForm] = useState<FormState>(EMPTY_FORM);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [importMode, setImportMode] = useState<'upsert' | 'replace'>('upsert');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourcePathError = useMemo(() => validateSourcePath(form.source_path), [form.source_path]);
  const targetUrlError = useMemo(() => validateTargetUrl(form.target_url), [form.target_url]);
  const hasLiveValidationErrors = Boolean(sourcePathError || targetUrlError);
  const inlineSourcePathError = useMemo(() => validateSourcePath(inlineForm.source_path), [inlineForm.source_path]);
  const inlineTargetUrlError = useMemo(() => validateTargetUrl(inlineForm.target_url), [inlineForm.target_url]);
  const hasInlineValidationErrors = Boolean(inlineSourcePathError || inlineTargetUrlError);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: `${page}` });
    if (query.trim()) params.set('q', query.trim());
    params.set('is_active', 'true');
    return params.toString();
  }, [page, query]);

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
  }

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasLiveValidationErrors) {
      setError('Fix validation errors before saving.');
      return;
    }
    setIsSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        source_path: form.source_path,
        target_url: form.target_url,
        status_code: Number.parseInt(form.status_code, 10),
        match_type: form.match_type,
        is_active: true,
        priority: Number.parseInt(form.priority || '100', 10),
        notes: form.notes
      };

      const res = await fetch('/api/admin/redirects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save redirect.');

      setMessage('Redirect created.');
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

  function startInlineEdit(item: RedirectItem) {
    setInlineEditId(item.id);
    setInlineForm({
      source_path: item.source_path,
      target_url: item.target_url,
      status_code: `${item.status_code}` as FormState['status_code'],
      match_type: item.match_type,
      is_active: true,
      priority: `${item.priority}`,
      notes: item.notes || ''
    });
    setMessage('');
    setError('');
  }

  function closeInlineEdit() {
    setInlineEditId(null);
    setInlineForm(EMPTY_FORM);
  }

  async function submitInlineEdit(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (hasInlineValidationErrors) {
      setError('Fix validation errors before saving.');
      return;
    }

    setIsInlineSaving(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        source_path: inlineForm.source_path,
        target_url: inlineForm.target_url,
        status_code: Number.parseInt(inlineForm.status_code, 10),
        match_type: inlineForm.match_type,
        is_active: true,
        priority: Number.parseInt(inlineForm.priority || '100', 10),
        notes: inlineForm.notes
      };

      const res = await fetch(`/api/admin/redirects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save redirect.');

      setMessage('Redirect updated.');
      closeInlineEdit();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save redirect.');
    } finally {
      setIsInlineSaving(false);
    }
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

    if (inlineEditId === id) closeInlineEdit();
    setMessage('Redirect deleted.');
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
            <h2 className="text-xl font-bold">Add Redirect</h2>
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
                onBlur={(event) => {
                  const raw = event.target.value.trim();
                  if (!raw || raw.startsWith('/')) return;
                  setForm((prev) => ({ ...prev, source_path: `/${raw}` }));
                }}
                aria-invalid={Boolean(sourcePathError)}
                required
              />
              {sourcePathError ? <p className="mt-1 text-xs font-semibold text-carnival-red">{sourcePathError}</p> : null}
            </label>

            <label className="label">
              Target URL
              <input
                className="input mt-1"
                placeholder="/new-page or https://example.com/page"
                value={form.target_url}
                onChange={(event) => setForm((prev) => ({ ...prev, target_url: event.target.value }))}
                aria-invalid={Boolean(targetUrlError)}
                required
              />
              {targetUrlError ? <p className="mt-1 text-xs font-semibold text-carnival-red">{targetUrlError}</p> : null}
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

          <button type="submit" className="btn-primary" disabled={isSaving || hasLiveValidationErrors}>
            {isSaving ? 'Saving…' : 'Create Redirect'}
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
            CSV headers: source_path,target_url,status_code,match_type,priority,notes (is_active optional)
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

        </div>

        <div className="overflow-visible">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">From / To</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                if (inlineEditId === item.id) {
                  return (
                    <tr key={item.id} className="border-b bg-white/60">
                      <td className="py-3 pr-3">
                        <form className="space-y-3" onSubmit={(event) => void submitInlineEdit(event, item.id)}>
                          <div className="grid gap-3 md:grid-cols-2">
                            <label className="label md:col-span-2">
                              From
                              <input
                                className="input mt-1"
                                placeholder="/old-page"
                                value={inlineForm.source_path}
                                onChange={(event) => setInlineForm((prev) => ({ ...prev, source_path: event.target.value }))}
                                onBlur={(event) => {
                                  const raw = event.target.value.trim();
                                  if (!raw || raw.startsWith('/')) return;
                                  setInlineForm((prev) => ({ ...prev, source_path: `/${raw}` }));
                                }}
                                aria-invalid={Boolean(inlineSourcePathError)}
                                required
                              />
                              {inlineSourcePathError ? <p className="mt-1 text-xs font-semibold text-carnival-red">{inlineSourcePathError}</p> : null}
                            </label>

                            <label className="label md:col-span-2">
                              To
                              <input
                                className="input mt-1"
                                placeholder="/new-page or https://example.com/page"
                                value={inlineForm.target_url}
                                onChange={(event) => setInlineForm((prev) => ({ ...prev, target_url: event.target.value }))}
                                aria-invalid={Boolean(inlineTargetUrlError)}
                                required
                              />
                              {inlineTargetUrlError ? <p className="mt-1 text-xs font-semibold text-carnival-red">{inlineTargetUrlError}</p> : null}
                            </label>

                            <label className="label">
                              Match type
                              <select
                                className="input mt-1"
                                value={inlineForm.match_type}
                                onChange={(event) => setInlineForm((prev) => ({ ...prev, match_type: event.target.value as 'exact' | 'prefix' }))}
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
                                value={inlineForm.status_code}
                                onChange={(event) =>
                                  setInlineForm((prev) => ({ ...prev, status_code: event.target.value as FormState['status_code'] }))
                                }
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
                                value={inlineForm.priority}
                                onChange={(event) => setInlineForm((prev) => ({ ...prev, priority: event.target.value }))}
                                required
                              />
                            </label>
                          </div>

                          <label className="label">
                            Notes
                            <textarea
                              className="input mt-1"
                              rows={2}
                              value={inlineForm.notes}
                              onChange={(event) => setInlineForm((prev) => ({ ...prev, notes: event.target.value }))}
                              placeholder="Optional notes"
                            />
                          </label>

                          <div className="flex flex-wrap gap-2">
                            <button type="submit" className="btn-primary" disabled={isInlineSaving || hasInlineValidationErrors}>
                              {isInlineSaving ? 'Saving…' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              onClick={() => closeInlineEdit()}
                              disabled={isInlineSaving}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="btn-secondary text-carnival-red"
                              onClick={() => void deleteRow(item.id)}
                              disabled={isInlineSaving}
                            >
                              Delete
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={item.id} className="border-b last:border-b-0 align-top">
                    <td className="py-2 pr-3">
                      <button
                        type="button"
                        className="block w-full text-left"
                        onClick={() => startInlineEdit(item)}
                        aria-label={`Edit redirect from ${item.source_path}`}
                      >
                        <div className="flex items-start gap-2">
                          <span className="min-w-10 pt-2 text-xs font-bold uppercase tracking-wide text-carnival-ink/60">From</span>
                          <p className="w-full break-all rounded-md bg-carnival-cream/60 px-3 py-2 text-xs font-semibold leading-snug sm:text-sm">
                            {item.source_path}
                          </p>
                        </div>
                        <div className="mt-2 flex items-start gap-2">
                          <span className="min-w-10 pt-2 text-xs font-bold uppercase tracking-wide text-carnival-ink/60">To</span>
                          <p className="w-full break-all rounded-md bg-carnival-cream/60 px-3 py-2 text-xs leading-snug sm:text-sm">
                            {item.target_url}
                          </p>
                        </div>
                      </button>
                    </td>
                  </tr>
                );
              })}

              {!items.length && !isLoading ? (
                <tr>
                  <td className="py-4">No redirects found for the selected filters.</td>
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
