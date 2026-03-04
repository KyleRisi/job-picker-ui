'use client';

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Job } from '@/lib/types';
import { normalizeSalaryBenefitOptions } from '@/lib/job-salary';
import { StatusPill } from '@/components/status-pill';

export function AdminJobsForm({
  jobs,
  filledApplicationByJobId,
  holderNameByJobId,
  reportsToOptions,
  salaryBenefitOptions,
  showPersonNameColumn = true,
  isFilledView = false,
  isRehiringView = false,
  isReadyForShowView = false,
  readyForShowMetaByJobId = {},
  broadcastFilter = 'ALL',
  rehiringResignCountByJobId = {},
  initialPanel,
  panelTrigger
}: {
  jobs: Job[];
  filledApplicationByJobId: Record<string, string>;
  holderNameByJobId: Record<string, string>;
  reportsToOptions: string[];
  salaryBenefitOptions: string[];
  showPersonNameColumn?: boolean;
  isFilledView?: boolean;
  isRehiringView?: boolean;
  isReadyForShowView?: boolean;
  readyForShowMetaByJobId?: Record<string, { applicationId: string; broadcasted: boolean }>;
  broadcastFilter?: string;
  rehiringResignCountByJobId?: Record<string, number>;
  initialPanel?: 'single' | 'bulk' | null;
  panelTrigger?: string;
}) {
  const availableSalaryOptions = useMemo(
    () => normalizeSalaryBenefitOptions(salaryBenefitOptions),
    [salaryBenefitOptions]
  );
  const [message, setMessage] = useState('');
  const [activePanel, setActivePanel] = useState<'single' | 'bulk' | null>(initialPanel ?? null);
  const [rowActionOpenId, setRowActionOpenId] = useState<string | null>(null);
  const [bulkTab, setBulkTab] = useState<'new' | 'existing'>('new');
  const [bulkCsv, setBulkCsv] = useState('');
  const [bulkFileInputKey, setBulkFileInputKey] = useState(0);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [salaryPreset, setSalaryPreset] = useState<string>(availableSalaryOptions[0]);
  const [salaryCustom, setSalaryCustom] = useState('');
  const [fireTarget, setFireTarget] = useState<{ applicationId: string; name: string; title: string } | null>(null);
  const [fireSubmitting, setFireSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string; jobRef: string } | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [broadcastSubmitting, setBroadcastSubmitting] = useState(false);
  const actionsContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const statusFilter = (searchParams.get('status') || 'ALL').toUpperCase();

  useEffect(() => {
    setActivePanel(initialPanel ?? null);
  }, [initialPanel, panelTrigger]);

  useEffect(() => {
    if (activePanel === 'bulk') setMessage('');
  }, [activePanel, bulkTab]);

  function closePanel() {
    setActivePanel(null);
    setBulkCsv('');
    setBulkSubmitting(false);
    setSalaryPreset(availableSalaryOptions[0]);
    setSalaryCustom('');
    setBulkFileInputKey((k) => k + 1);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('action');
    params.delete('at');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  useEffect(() => {
    if (salaryPreset !== '__custom__' && !availableSalaryOptions.includes(salaryPreset)) {
      setSalaryPreset(availableSalaryOptions[0]);
    }
  }, [salaryPreset, availableSalaryOptions]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!rowActionOpenId) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (!actionsContainerRef.current?.contains(target)) {
        setRowActionOpenId(null);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setRowActionOpenId(null);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [rowActionOpenId]);

  function closePanelAndRefresh() {
    closePanel();
    router.refresh();
  }

  function updateStatusFilter(nextStatus: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextStatus === 'ALL') {
      params.delete('status');
      params.delete('broadcast');
    } else {
      params.set('status', nextStatus);
      if (nextStatus !== 'READY_FOR_SHOW') {
        params.delete('broadcast');
      } else if (!params.get('broadcast')) {
        params.set('broadcast', 'ALL');
      }
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function updateBroadcastFilter(nextFilter: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('status', 'READY_FOR_SHOW');
    params.set('broadcast', nextFilter);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }
  const nextJobRef = (() => {
    let max = 0;
    for (const job of jobs) {
      const match = /^JOB-(\d+)$/i.exec(job.job_ref || '');
      if (!match) continue;
      const n = Number.parseInt(match[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
    return `JOB-${String(max + 1).padStart(4, '0')}`;
  })();

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    const salaryBenefits = salaryPreset === '__custom__' ? salaryCustom.trim() : salaryPreset;
    if (!salaryBenefits) {
      setMessage('Please choose or enter salary + benefits.');
      return;
    }
    payload.salary_benefits = salaryBenefits;
    const res = await fetch('/api/admin/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    setMessage(data.message || data.error || 'Done');
    if (res.ok) closePanelAndRefresh();
  }

  async function remove(id: string) {
    setDeleteSubmitting(true);
    const res = await fetch('/api/admin/jobs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const data = await res.json();
    if (res.ok) {
      window.location.reload();
      return;
    }
    setMessage(data.error || 'Could not delete this job.');
    setDeleteSubmitting(false);
  }

  async function fire(applicationId: string) {
    setFireSubmitting(true);
    const res = await fetch(`/api/admin/applications/${applicationId}/fire`, {
      method: 'POST'
    });
    const data = await res.json();
    if (res.ok) {
      window.location.reload();
      return;
    }
    setMessage(data.error || 'Could not fire this person.');
    setFireSubmitting(false);
  }

  async function markBroadcasted(applicationId: string, broadcasted: boolean) {
    setBroadcastSubmitting(true);
    const res = await fetch(`/api/admin/applications/${applicationId}/broadcast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ broadcasted })
    });
    const data = await res.json();
    if (res.ok) {
      window.location.reload();
      return;
    }
    setMessage(data.error || 'Could not update broadcast status.');
    setBroadcastSubmitting(false);
  }

  async function bulk(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!bulkCsv.trim()) {
      setMessage('Choose a CSV file first.');
      return;
    }
    setBulkSubmitting(true);
    try {
      const endpoint = bulkTab === 'existing' ? '/api/admin/jobs/bulk-existing' : '/api/admin/jobs/bulk';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: bulkCsv })
      });
      const bodyText = await res.text();
      let data: { message?: string; error?: string } = {};
      try {
        data = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        data = {};
      }
      setMessage(data.message || data.error || (res.ok ? 'Upload complete.' : 'Upload failed.'));
      if (res.ok) {
        closePanelAndRefresh();
        return;
      }
    } catch {
      setMessage('Upload failed due to a network or server error.');
    } finally {
      setBulkSubmitting(false);
    }
  }

  async function applyCsvFile(file?: File) {
    if (!file) return;
    const text = await file.text();
    setBulkCsv(text);
  }

  async function onCsvFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setMessage('');
    try {
      await applyCsvFile(file);
    } catch {
      setBulkCsv('');
      setBulkFileInputKey((k) => k + 1);
      setMessage('Could not read this CSV file. Please re-save it as CSV and try again.');
    }
  }

  return (
    <div className="space-y-6" ref={actionsContainerRef}>
      {activePanel === 'single' ? (
        <form onSubmit={submit} className="card grid gap-3 md:grid-cols-2">
          <h2 className="md:col-span-2 text-xl font-bold">Create job</h2>
          {reportsToOptions.length === 0 ? (
            <p className="md:col-span-2 rounded-md bg-amber-100 p-3">
              No hiring managers configured. Add them in <a className="underline font-semibold" href="/admin/settings">Settings</a> first.
            </p>
          ) : null}
          <div><label className="label">Title</label><input className="input" name="title" required /></div>
          <div>
            <label className="label">Job Number</label>
            <input className="input" value={nextJobRef} readOnly aria-readonly="true" />
            <p className="mt-1 text-sm">Automatically assigned and locked.</p>
          </div>
          <div>
            <label className="label">Reports to</label>
            <select className="input" name="reports_to" required>
              <option value="">Select hiring manager</option>
              {reportsToOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input" name="status" required>
              <option value="AVAILABLE">AVAILABLE</option>
              <option value="FILLED">FILLED</option>
              <option value="REHIRING">REHIRING</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="salaryPreset">Salary + benefits</label>
            <select
              className="input"
              id="salaryPreset"
              value={salaryPreset}
              onChange={(e) => setSalaryPreset(e.currentTarget.value)}
              required
            >
              {availableSalaryOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
              <option value="__custom__">Custom...</option>
            </select>
          </div>
          {salaryPreset === '__custom__' ? (
            <div>
              <label className="label" htmlFor="salaryCustom">Custom salary + benefits</label>
              <input
                className="input"
                id="salaryCustom"
                value={salaryCustom}
                onChange={(e) => setSalaryCustom(e.currentTarget.value)}
                placeholder="$120k + private confetti launcher"
                required
              />
            </div>
          ) : null}
          <div className="md:col-span-2"><label className="label">Description</label><textarea className="input" name="description" required /></div>
          <div className="md:col-span-2 flex gap-2">
            <button className="btn-primary" type="submit" disabled={reportsToOptions.length === 0}>Create job</button>
            <button className="btn-secondary" type="button" onClick={closePanel}>Cancel</button>
          </div>
        </form>
      ) : null}

      {activePanel === 'bulk' ? (
        <form onSubmit={bulk} className="card space-y-3">
          <h2 className="text-xl font-bold">Bulk CSV upload</h2>
          <div className="flex gap-2">
            <button
              type="button"
              className={bulkTab === 'new' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => {
                setBulkTab('new');
                setBulkCsv('');
                setBulkFileInputKey((k) => k + 1);
                setMessage('');
              }}
            >
              New Roles
            </button>
            <button
              type="button"
              className={bulkTab === 'existing' ? 'btn-primary' : 'btn-secondary'}
              onClick={() => {
                setBulkTab('existing');
                setBulkCsv('');
                setBulkFileInputKey((k) => k + 1);
                setMessage('');
              }}
            >
              Existing Employees
            </button>
          </div>
          {bulkTab === 'new' ? (
            <p>Header: title,description (job number, reports to, and status=AVAILABLE are auto-assigned on import)</p>
          ) : (
            <p>Header: title,description,full_name,email,q1,q2,q3,day_to_day,incidents,kpi_assessment,consent_read_on_show (use Y or N for consent; status is auto-set to FILLED; salary/reports-to are auto-assigned)</p>
          )}
          <a
            className="btn-secondary"
            href={bulkTab === 'existing' ? '/admin/jobs/template-existing.csv' : '/admin/jobs/template.csv'}
          >
            Download CSV template
          </a>
          <label className="block text-sm font-semibold" htmlFor="bulkCsvFile">Upload CSV</label>
          <input
            key={bulkFileInputKey}
            id="bulkCsvFile"
            className="input"
            type="file"
            accept=".csv,text/csv"
            onChange={onCsvFileChange}
          />
          <div className="flex gap-2">
            <button className="btn-primary" type="submit" disabled={!bulkCsv.trim() || bulkSubmitting}>
              {bulkSubmitting ? 'Uploading...' : 'Upload CSV'}
            </button>
            <button className="btn-secondary" type="button" onClick={closePanel}>Cancel</button>
          </div>
          {message ? <p className="rounded-md bg-blue-100 p-3">{message}</p> : null}
        </form>
      ) : null}

      <section className="card overflow-visible">
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="label">
            Status
            <select
              className="input mt-1"
              value={statusFilter}
              onChange={(event) => updateStatusFilter(event.target.value)}
            >
              <option value="ALL">All jobs</option>
              <option value="AVAILABLE">Available jobs</option>
              <option value="FILLED">Filled jobs</option>
              <option value="REHIRING">Re-hiring jobs</option>
              <option value="READY_FOR_SHOW">Ready for show</option>
            </select>
          </label>

          {isReadyForShowView ? (
            <label className="label">
              Broadcast
              <select
                className="input mt-1"
                value={broadcastFilter}
                onChange={(event) => updateBroadcastFilter(event.target.value)}
              >
                <option value="ALL">All</option>
                <option value="BROADCAST">Broadcast</option>
                <option value="NOT_BROADCAST">Not broadcast</option>
              </select>
            </label>
          ) : null}
        </div>
        <div className="mt-3 space-y-3 md:hidden">
          {jobs.map((job) => {
            const meta = readyForShowMetaByJobId[job.id];
            const isFilled = job.status === 'FILLED';
            const holderName = isReadyForShowView
              ? holderNameByJobId[job.id] || '-'
              : isFilled
                ? holderNameByJobId[job.id] || '-'
                : '-';

            return (
              <article key={job.id} className="rounded-lg border border-carnival-ink/15 bg-white p-3 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-carnival-ink/70">{job.job_ref}</p>
                    <p className="mt-1 text-sm font-bold leading-tight">{job.title}</p>
                  </div>
                  {!isReadyForShowView ? <StatusPill status={job.status} /> : null}
                </div>

                <div className="mt-2 space-y-1 text-xs">
                  {isRehiringView ? (
                    <p><span className="font-semibold">Resignations:</span> {rehiringResignCountByJobId[job.id] || 0}</p>
                  ) : null}
                  {(showPersonNameColumn || isReadyForShowView) && !isRehiringView ? (
                    <p><span className="font-semibold">Person:</span> {holderName}</p>
                  ) : null}
                  {isReadyForShowView ? (
                    <p><span className="font-semibold">Broadcasted:</span> {meta?.broadcasted ? 'Yes' : 'No'}</p>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {isFilledView ? (
                    <Link className="btn-secondary text-xs" href={`/admin/applications/${filledApplicationByJobId[job.id]}`}>
                      View
                    </Link>
                  ) : (
                    <>
                      {isFilled && filledApplicationByJobId[job.id] ? (
                        <Link className="btn-secondary text-xs" href={`/admin/applications/${filledApplicationByJobId[job.id]}`}>
                          View
                        </Link>
                      ) : null}
                      <Link className="btn-secondary text-xs" href={`/admin/jobs/${job.id}`}>
                        Edit
                      </Link>
                      {isReadyForShowView && meta?.applicationId ? (
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={() => markBroadcasted(meta.applicationId, !meta.broadcasted)}
                          disabled={broadcastSubmitting}
                        >
                          {meta.broadcasted ? 'Mark not broadcasted' : 'Broadcast'}
                        </button>
                      ) : null}
                      {isFilled ? (
                        <button
                          type="button"
                          className="btn-primary text-xs"
                          onClick={() => {
                            const appId = filledApplicationByJobId[job.id];
                            if (!appId) {
                              setMessage('Cannot fire this role because no active application record was found.');
                              return;
                            }
                            setFireTarget({
                              applicationId: appId,
                              name: holderNameByJobId[job.id] || 'this user',
                              title: job.title
                            });
                          }}
                        >
                          Fire
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={() => {
                            setDeleteTarget({
                              id: job.id,
                              title: job.title,
                              jobRef: job.job_ref || 'N/A'
                            });
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <table className="mt-3 hidden min-w-full text-left text-sm md:table">
            <thead>
            {isRehiringView ? (
              <tr>
                <th className="pb-3 pr-3">Job Number</th>
                <th className="pb-3 pr-3">Job Title</th>
                <th className="pb-3 pr-3">Resignations</th>
                <th className="pb-3 pr-3">Status</th>
                <th className="pb-3">Actions</th>
              </tr>
            ) : isReadyForShowView ? (
              <tr>
                <th className="pb-3 pr-3">Job Number</th>
                <th className="pb-3 pr-3">Person&apos;s Name</th>
                <th className="pb-3 pr-3">Job Title</th>
                <th className="pb-3 pr-3">Broadcasted</th>
                <th className="pb-3">Actions</th>
              </tr>
            ) : (
              <tr>
                <th className="pb-3 pr-3">Job Number</th>
                {showPersonNameColumn ? <th className="pb-3 pr-3">Person&apos;s Name</th> : null}
                <th className="pb-3 pr-3">Job Title</th>
                <th className="pb-3 pr-3">Status</th>
                <th className="pb-3">Actions</th>
              </tr>
            )}
            </thead>
            <tbody>
            {jobs.map((job, idx) => (
              <tr key={job.id} className="border-t">
                <td className="py-2.5 pr-3 align-middle">{job.job_ref}</td>
                {isRehiringView ? null : (showPersonNameColumn || isReadyForShowView ? (
                  <td className="py-2.5 pr-3 align-middle">{isReadyForShowView ? (holderNameByJobId[job.id] || '-') : (job.status === 'FILLED' ? holderNameByJobId[job.id] || '-' : '-')}</td>
                ) : null)}
                <td className="py-2.5 pr-3 align-middle">{job.title}</td>
                {isRehiringView ? (
                  <>
                    <td className="py-2.5 pr-3 align-middle text-center">{rehiringResignCountByJobId[job.id] || 0}</td>
                    <td className="py-2.5 pr-3 align-middle"><StatusPill status={job.status} /></td>
                  </>
                ) : isReadyForShowView ? (
                  <>
                    <td className="py-2.5 pr-3 align-middle">{readyForShowMetaByJobId[job.id]?.broadcasted ? 'Yes' : 'No'}</td>
                  </>
                ) : (
                  <td className="py-2.5 pr-3 align-middle"><StatusPill status={job.status} /></td>
                )}
                <td className="py-2.5 align-middle">
                  {isFilledView ? (
                    filledApplicationByJobId[job.id] ? (
                      <Link className="btn-secondary" href={`/admin/applications/${filledApplicationByJobId[job.id]}`}>
                        View
                      </Link>
                    ) : (
                      <span className="text-xs text-carnival-ink/60">No application</span>
                    )
                  ) : (
                    <div className="relative inline-block">
                      <button
                        type="button"
                        className="btn-secondary"
                        aria-haspopup="menu"
                        aria-expanded={rowActionOpenId === job.id}
                        onClick={() => setRowActionOpenId((prev) => (prev === job.id ? null : job.id))}
                      >
                        Actions
                      </button>
                      {rowActionOpenId === job.id ? (
                        (() => {
                          const openUpwards = idx >= jobs.length - 2;
                          const viewHref = job.status === 'FILLED' && filledApplicationByJobId[job.id]
                            ? `/admin/applications/${filledApplicationByJobId[job.id]}`
                            : `/admin/jobs/${job.id}`;
                          return (
                        <div
                          role="menu"
                          className={`absolute right-0 z-[70] w-40 rounded-md border border-carnival-ink/20 bg-white p-1 shadow-card ${
                            openUpwards ? 'bottom-full mb-2' : 'top-full mt-2'
                          }`}
                        >
                          <Link
                            className="block rounded px-3 py-2 hover:bg-carnival-cream"
                            href={viewHref}
                            onClick={() => setRowActionOpenId(null)}
                          >
                            View
                          </Link>
                          <Link
                            className="block rounded px-3 py-2 hover:bg-carnival-cream"
                            href={`/admin/jobs/${job.id}`}
                            onClick={() => setRowActionOpenId(null)}
                          >
                            Edit
                          </Link>
                        </div>
                          );
                        })()
                      ) : null}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            </tbody>
        </table>
      </section>

      {message && activePanel !== 'bulk' ? <p className="rounded-md bg-blue-100 p-3">{message}</p> : null}
      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-carnival-ink/20 bg-white p-5 shadow-card">
            <h3 className="text-lg font-bold">Confirm delete</h3>
            <p className="mt-2 text-sm">
              Are you sure you want to delete <strong>{deleteTarget.title}</strong> ({deleteTarget.jobRef})?
            </p>
            <p className="mt-2 text-xs text-carnival-ink/70">
              This action permanently removes the job record.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleteSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => remove(deleteTarget.id)}
                disabled={deleteSubmitting}
              >
                {deleteSubmitting ? 'Deleting...' : 'Yes, delete record'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {fireTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-carnival-ink/20 bg-white p-5 shadow-card">
            <h3 className="text-lg font-bold">Confirm fire action</h3>
            <p className="mt-2 text-sm">
              Are you sure you want to fire <strong>{fireTarget.name}</strong> from <strong>{fireTarget.title}</strong>?
            </p>
            <p className="mt-2 text-xs text-carnival-ink/70">
              This will clear the active assignment and make the role available again.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setFireTarget(null)}
                disabled={fireSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => fire(fireTarget.applicationId)}
                disabled={fireSubmitting}
              >
                {fireSubmitting ? 'Firing...' : 'Yes, fire user'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
