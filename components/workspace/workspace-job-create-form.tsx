'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeSalaryBenefitOptions } from '@/lib/job-salary';

type Props = {
  nextJobRef: string;
  reportsToOptions: string[];
  salaryBenefitOptions: string[];
};

export function WorkspaceJobCreateForm({
  nextJobRef,
  reportsToOptions,
  salaryBenefitOptions
}: Props) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [isError, setIsError] = useState(false);
  const availableSalaryOptions = useMemo(
    () => normalizeSalaryBenefitOptions(salaryBenefitOptions),
    [salaryBenefitOptions]
  );
  const [salaryPreset, setSalaryPreset] = useState<string>(availableSalaryOptions[0]);
  const [salaryCustom, setSalaryCustom] = useState('');

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

    const response = await fetch('/api/admin/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data?.error || data?.message || 'Could not create job.');
      setIsError(true);
      setSaving(false);
      return;
    }

    setMessage(data?.message || 'Job created.');
    setIsError(false);
    setSaving(false);
    setTimeout(() => {
      router.push('/workspace/dashboard/jobs');
      router.refresh();
    }, 300);
  }

  return (
    <form onSubmit={onSubmit} className="rounded-md border border-slate-300 bg-white p-4 sm:p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="title">Title</label>
          <input
            id="title"
            name="title"
            required
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="job_ref">Job Number</label>
          <input
            id="job_ref"
            name="job_ref"
            value={nextJobRef}
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
            required
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900"
          >
            <option value="">Select hiring manager</option>
            {reportsToOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="status">Status</label>
          <select
            id="status"
            name="status"
            defaultValue="AVAILABLE"
            required
            className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900"
          >
            <option value="AVAILABLE">AVAILABLE</option>
            <option value="FILLED">FILLED</option>
            <option value="REHIRING">REHIRING</option>
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
          <div>
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
          {saving ? 'Creating...' : 'Create job'}
        </button>
        <a
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          href="/workspace/dashboard/jobs"
        >
          Cancel
        </a>
      </div>

      {message ? (
        <p className={`mt-4 rounded-md px-3 py-2 text-sm ${isError ? 'border border-rose-300 bg-rose-50 text-rose-700' : 'border border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
          {message}
        </p>
      ) : null}
    </form>
  );
}
