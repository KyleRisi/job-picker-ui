'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Job } from '@/lib/types';
import { getDefaultSalaryBenefits, normalizeSalaryBenefitOptions } from '@/lib/job-salary';

type Props = {
  job: Job;
  reportsToOptions: string[];
  salaryBenefitOptions: string[];
  rehiringReasons: string[];
  afterSaveRedirectPath?: string;
  cancelHref?: string;
};

export function WorkspaceJobEditForm({
  job,
  reportsToOptions,
  salaryBenefitOptions,
  rehiringReasons,
  afterSaveRedirectPath = '/workspace/dashboard/jobs',
  cancelHref = '/workspace/dashboard/jobs'
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [isError, setIsError] = useState(false);
  const [status, setStatus] = useState<'AVAILABLE' | 'FILLED' | 'REHIRING'>(job.status);
  const [rehiringReason, setRehiringReason] = useState((job.rehiring_reason || '').trim());
  const [actionsOpen, setActionsOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const availableSalaryOptions = normalizeSalaryBenefitOptions(salaryBenefitOptions);
  const currentSalaryBenefits =
    (job.salary_benefits || '').trim() || getDefaultSalaryBenefits(job.job_ref || '', availableSalaryOptions);
  const hasPresetSalary = availableSalaryOptions.includes(currentSalaryBenefits);
  const [salaryPreset, setSalaryPreset] = useState<string>(hasPresetSalary ? currentSalaryBenefits : '__custom__');
  const [salaryCustom, setSalaryCustom] = useState<string>(hasPresetSalary ? '' : currentSalaryBenefits);
  const allowedManagers = reportsToOptions.map((value) => value.trim()).filter(Boolean);
  const hasValidCurrentManager = allowedManagers.includes(job.reports_to);

  useEffect(() => {
    function onPointerDown(event: MouseEvent | TouchEvent) {
      if (!actionsOpen) return;
      const target = event.target as Node | null;
      if (!target) return;
      if (!actionsRef.current?.contains(target)) {
        setActionsOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setActionsOpen(false);
      }
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [actionsOpen]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setIsError(false);

    const payload = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    const salaryBenefits = salaryPreset === '__custom__' ? salaryCustom.trim() : salaryPreset;
    if (!salaryBenefits) {
      setMessage('Please choose or enter salary + benefits.');
      setIsError(true);
      setSaving(false);
      return;
    }

    payload.salary_benefits = salaryBenefits;
    payload.status = status;
    payload.rehiring_reason = status === 'REHIRING' ? rehiringReason : '';

    const response = await fetch('/api/admin/jobs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: job.id, ...payload })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data?.error || data?.message || 'Could not save changes.');
      setIsError(true);
      setSaving(false);
      return;
    }

    setMessage(data?.message || 'Job updated.');
    setIsError(false);
    setSaving(false);
    setTimeout(() => {
      router.push(afterSaveRedirectPath);
      router.refresh();
    }, 350);
  }

  async function onDeleteJob() {
    setDeleteSubmitting(true);
    setMessage('');
    setIsError(false);
    try {
      const response = await fetch('/api/admin/jobs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: job.id })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage(data?.error || data?.message || 'Could not delete this job.');
        setIsError(true);
        return;
      }

      router.push('/workspace/dashboard/jobs');
      router.refresh();
    } finally {
      setDeleteSubmitting(false);
      setDeleteModalOpen(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-md border border-slate-300 bg-white p-4 sm:p-5">
      <div className="mb-4 flex justify-end" ref={actionsRef}>
        <div className="relative">
          <button
            type="button"
            onClick={() => setActionsOpen((current) => !current)}
            className="inline-flex h-9 items-center rounded-md bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Actions
          </button>
          {actionsOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-44 rounded-md border border-slate-300 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setActionsOpen(false);
                  setDeleteModalOpen(true);
                }}
                className="block w-full px-3 py-2 text-left text-sm font-medium text-rose-700 hover:bg-rose-50"
              >
                Delete job
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="title">Title</label>
          <input
            id="title"
            name="title"
            defaultValue={job.title}
            required
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="job_ref_display">Job Number</label>
          <input
            id="job_ref_display"
            defaultValue={job.job_ref}
            readOnly
            aria-readonly="true"
            className="h-10 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-700"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="reports_to">Reports to</label>
          <select
            id="reports_to"
            name="reports_to"
            defaultValue={hasValidCurrentManager ? job.reports_to : ''}
            required
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900"
          >
            <option value="">Select hiring manager</option>
            {allowedManagers.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {!hasValidCurrentManager ? (
            <p className="mt-1 text-xs text-rose-700">
              Current manager is not in Settings. Please select one of the configured hiring managers.
            </p>
          ) : null}
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="status">Status</label>
          <select
            id="status"
            name="status"
            value={status}
            onChange={(event) => setStatus(event.currentTarget.value as 'AVAILABLE' | 'FILLED' | 'REHIRING')}
            required
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900"
          >
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="FILLED">FILLED</option>
            <option value="REHIRING">REHIRING</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="rehiring_reason">Re-hiring reason</label>
          <select
            id="rehiring_reason"
            name="rehiring_reason"
            value={rehiringReason}
            onChange={(event) => setRehiringReason(event.currentTarget.value)}
            disabled={status !== 'REHIRING'}
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
          >
            <option value="">Auto random reason</option>
            {rehiringReasons.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="salaryPreset">Salary + benefits</label>
          <select
            id="salaryPreset"
            value={salaryPreset}
            onChange={(event) => setSalaryPreset(event.currentTarget.value)}
            required
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900"
          >
            {availableSalaryOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
            <option value="__custom__">Custom...</option>
          </select>
        </div>

        {salaryPreset === '__custom__' ? (
          <div className="md:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="salaryCustom">Custom salary + benefits</label>
            <input
              id="salaryCustom"
              value={salaryCustom}
              onChange={(event) => setSalaryCustom(event.currentTarget.value)}
              placeholder="$120k + private confetti launcher"
              required
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900"
            />
          </div>
        ) : null}

        <div className="md:col-span-2">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            defaultValue={job.description}
            required
            className="min-h-40 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="inline-flex h-9 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
          type="submit"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
        <a
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          href={cancelHref}
        >
          Cancel
        </a>
      </div>

      {message ? (
        <p className={`mt-4 rounded-md px-3 py-2 text-sm ${isError ? 'border border-rose-300 bg-rose-50 text-rose-700' : 'border border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
          {message}
        </p>
      ) : null}

      {deleteModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-md border border-slate-300 bg-white p-5 shadow-xl">
            <h2 className="text-base font-semibold text-slate-900">Delete this job?</h2>
            <p className="mt-2 text-sm text-slate-700">
              This action is irreversible. Are you sure you want to continue?
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleteSubmitting}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void onDeleteJob()}
                disabled={deleteSubmitting}
                className="inline-flex h-9 items-center justify-center rounded-md bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {deleteSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
