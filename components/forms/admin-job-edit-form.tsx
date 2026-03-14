'use client';

import { FormEvent, useState } from 'react';
import { Job } from '@/lib/types';
import { getDefaultSalaryBenefits, normalizeSalaryBenefitOptions } from '@/lib/job-salary';

type Props = {
  job: Job;
  reportsToOptions: string[];
  salaryBenefitOptions: string[];
  rehiringReasons: string[];
  afterSaveRedirectPath?: string;
  cancelHref?: string;
};

export function AdminJobEditForm({
  job,
  reportsToOptions,
  salaryBenefitOptions,
  rehiringReasons,
  afterSaveRedirectPath = '/admin/jobs',
  cancelHref = '/admin/jobs'
}: Props) {
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'AVAILABLE' | 'FILLED' | 'REHIRING'>(job.status);
  const [rehiringReason, setRehiringReason] = useState((job.rehiring_reason || '').trim());
  const availableSalaryOptions = normalizeSalaryBenefitOptions(salaryBenefitOptions);
  const currentSalaryBenefits =
    (job.salary_benefits || '').trim() || getDefaultSalaryBenefits(job.job_ref || '', availableSalaryOptions);
  const hasPresetSalary = availableSalaryOptions.includes(currentSalaryBenefits);
  const [salaryPreset, setSalaryPreset] = useState<string>(hasPresetSalary ? currentSalaryBenefits : '__custom__');
  const [salaryCustom, setSalaryCustom] = useState<string>(hasPresetSalary ? '' : currentSalaryBenefits);
  const allowedManagers = reportsToOptions.map((v) => v.trim()).filter(Boolean);
  const hasValidCurrentManager = allowedManagers.includes(job.reports_to);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>;
    const salaryBenefits = salaryPreset === '__custom__' ? salaryCustom.trim() : salaryPreset;
    if (!salaryBenefits) {
      setMessage('Please choose or enter salary + benefits.');
      setSaving(false);
      return;
    }
    payload.salary_benefits = salaryBenefits;
    payload.status = status;
    payload.rehiring_reason = status === 'REHIRING' ? rehiringReason : '';

    const res = await fetch('/api/admin/jobs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: job.id, ...payload })
    });

    const data = await res.json();
    setMessage(data.message || data.error || 'Saved');
    setSaving(false);

    if (res.ok) {
      setTimeout(() => {
        window.location.assign(afterSaveRedirectPath);
      }, 500);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card grid gap-3 md:grid-cols-2">
      <h2 className="md:col-span-2 text-xl font-bold">Edit job</h2>
      <div>
        <label className="label" htmlFor="title">Title</label>
        <input className="input" id="title" name="title" defaultValue={job.title} required />
      </div>
      <div>
        <label className="label" htmlFor="job_ref_display">Job Number</label>
        <input className="input" id="job_ref_display" defaultValue={job.job_ref} readOnly aria-readonly="true" />
      </div>
      <div>
        <label className="label" htmlFor="reports_to">Reports to</label>
        <select
          className="input"
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
          <p className="mt-1 text-sm text-red-800">
            Current manager is not in Settings. Please select one of the configured hiring managers.
          </p>
        ) : null}
      </div>
      <div>
        <label className="label" htmlFor="status">Status</label>
        <select
          className="input"
          id="status"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.currentTarget.value as 'AVAILABLE' | 'FILLED' | 'REHIRING')}
          required
        >
          <option value="AVAILABLE">AVAILABLE</option>
          <option value="FILLED">FILLED</option>
          <option value="REHIRING">REHIRING</option>
        </select>
      </div>
      <div>
        <label className="label" htmlFor="rehiring_reason">Re-hiring reason</label>
        <select
          className="input"
          id="rehiring_reason"
          name="rehiring_reason"
          value={rehiringReason}
          onChange={(e) => setRehiringReason(e.currentTarget.value)}
          disabled={status !== 'REHIRING'}
        >
          <option value="">Auto random reason</option>
          {rehiringReasons.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
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
      <div className="md:col-span-2">
        <label className="label" htmlFor="description">Description</label>
        <textarea className="input min-h-40" id="description" name="description" defaultValue={job.description} required />
      </div>
      <div className="md:col-span-2 flex gap-2">
        <button className="btn-primary" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
        <a className="btn-secondary" href={cancelHref}>Cancel</a>
      </div>
      {message ? <p className="md:col-span-2 rounded-md bg-blue-100 p-3">{message}</p> : null}
    </form>
  );
}
