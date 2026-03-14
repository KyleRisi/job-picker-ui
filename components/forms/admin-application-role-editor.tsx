'use client';

import { FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDefaultSalaryBenefits, normalizeSalaryBenefitOptions } from '@/lib/job-salary';

type RoleEditorProps = {
  job: {
    id: string;
    title: string;
    description: string;
    reports_to: string;
    status: 'AVAILABLE' | 'FILLED' | 'REHIRING';
    salary_benefits: string | null;
    job_ref: string;
  };
  reportsToOptions: string[];
  salaryBenefitOptions: string[];
  onSaved?: () => void;
  closeOnSaveUrl?: string;
  variant?: 'admin' | 'workspace';
};

export function AdminApplicationRoleEditor({
  job,
  reportsToOptions,
  salaryBenefitOptions,
  onSaved,
  closeOnSaveUrl,
  variant = 'admin'
}: RoleEditorProps) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const availableSalaryOptions = useMemo(
    () => normalizeSalaryBenefitOptions(salaryBenefitOptions),
    [salaryBenefitOptions]
  );
  const currentSalaryBenefits =
    (job.salary_benefits || '').trim() || getDefaultSalaryBenefits(job.job_ref || '', availableSalaryOptions);
  const hasPresetSalary = availableSalaryOptions.includes(currentSalaryBenefits);
  const [salaryPreset, setSalaryPreset] = useState<string>(hasPresetSalary ? currentSalaryBenefits : '__custom__');
  const [salaryCustom, setSalaryCustom] = useState<string>(hasPresetSalary ? '' : currentSalaryBenefits);

  const allowedManagers = reportsToOptions.map((v) => v.trim()).filter(Boolean);
  const hasValidCurrentManager = allowedManagers.includes(job.reports_to);
  const isWorkspace = variant === 'workspace';

  const sectionClassName = isWorkspace
    ? 'rounded-md border border-slate-300 bg-white p-4 sm:p-5 space-y-4'
    : 'card space-y-4';
  const headingClassName = isWorkspace ? 'text-lg font-semibold text-slate-900' : 'text-xl font-bold';
  const labelClassName = isWorkspace
    ? 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600'
    : 'label';
  const inputClassName = isWorkspace
    ? 'h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900'
    : 'input';
  const textareaClassName = isWorkspace
    ? 'min-h-40 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900'
    : 'input min-h-40';
  const saveButtonClassName = isWorkspace
    ? 'inline-flex h-9 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60'
    : 'btn-primary';
  const messageClassName = isWorkspace
    ? 'rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-700'
    : 'rounded-md bg-blue-100 p-3';

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    const formData = new FormData(e.currentTarget);
    const title = `${formData.get('title') || ''}`.trim();
    const description = `${formData.get('description') || ''}`.trim();
    const reportsTo = `${formData.get('reports_to') || ''}`.trim();
    const salaryBenefits = (salaryPreset === '__custom__' ? salaryCustom : salaryPreset).trim();
    if (!title || !description || !reportsTo || !salaryBenefits) {
      setMessage('Please complete title, description, reports to, and salary + benefits.');
      setSaving(false);
      return;
    }

    const res = await fetch('/api/admin/jobs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: job.id,
        title,
        description,
        reports_to: reportsTo,
        salary_benefits: salaryBenefits,
        status: job.status
      })
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || 'Could not update role details.');
      setSaving(false);
      return;
    }
    onSaved?.();
    setSaving(false);
    if (closeOnSaveUrl) {
      router.replace(closeOnSaveUrl);
      return;
    }
    router.refresh();
  }

  return (
    <section className={sectionClassName}>
      <h2 className={headingClassName}>Role Details</h2>
      <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
        <div>
          <label className={labelClassName} htmlFor="title">Job title</label>
          <input className={inputClassName} id="title" name="title" defaultValue={job.title} required />
        </div>
        <div>
          <label className={labelClassName} htmlFor="reports_to">Reports to</label>
          <select
            className={inputClassName}
            id="reports_to"
            name="reports_to"
            defaultValue={hasValidCurrentManager ? job.reports_to : ''}
            required
          >
            <option value="">Select hiring manager</option>
            {allowedManagers.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {!hasValidCurrentManager ? (
            <p className="mt-1 text-sm text-red-800">Current manager is not in Settings. Please select one.</p>
          ) : null}
        </div>
        <div>
          <label className={labelClassName} htmlFor="salaryPreset">Salary + benefits</label>
          <select
            className={inputClassName}
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
            <label className={labelClassName} htmlFor="salaryCustom">Custom salary + benefits</label>
            <input
              className={inputClassName}
              id="salaryCustom"
              value={salaryCustom}
              onChange={(e) => setSalaryCustom(e.currentTarget.value)}
              placeholder="$120k + private confetti launcher"
              required
            />
          </div>
        ) : null}
        <div className="md:col-span-2">
          <label className={labelClassName} htmlFor="description">Description</label>
          <textarea className={textareaClassName} id="description" name="description" defaultValue={job.description} required />
        </div>
        <div className="md:col-span-2">
          <button className={saveButtonClassName} type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save role details'}
          </button>
        </div>
      </form>
      {message ? <p className={messageClassName}>{message}</p> : null}
    </section>
  );
}
