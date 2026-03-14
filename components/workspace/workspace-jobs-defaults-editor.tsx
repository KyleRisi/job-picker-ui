'use client';

import { useMemo, useState } from 'react';
import { normalizeSalaryBenefitOptions } from '@/lib/job-salary';
import { DEFAULT_REHIRING_REASONS } from '@/lib/constants';

type DefaultsTab = 'managers' | 'salary' | 'reasons';

function normalizeList(values: string[]) {
  return values.map((value) => `${value}`.trim()).filter(Boolean);
}

function dedupeCaseInsensitive(values: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  values.forEach((value) => {
    const normalized = value.toLowerCase();
    if (seen.has(normalized)) return;
    seen.add(normalized);
    out.push(value);
  });
  return out;
}

export function WorkspaceJobsDefaultsEditor({
  initialShowFilled,
  initialDisableSignups,
  initialManagers,
  initialSalaryOptions,
  initialRehiringReasons
}: {
  initialShowFilled: boolean;
  initialDisableSignups: boolean;
  initialManagers: string[];
  initialSalaryOptions: string[];
  initialRehiringReasons: string[];
}) {
  const [activeTab, setActiveTab] = useState<DefaultsTab>('managers');
  const [saving, setSaving] = useState(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  const [managers, setManagers] = useState<string[]>(dedupeCaseInsensitive(normalizeList(initialManagers)));
  const [salaryOptions, setSalaryOptions] = useState<string[]>(
    dedupeCaseInsensitive(normalizeSalaryBenefitOptions(normalizeList(initialSalaryOptions)))
  );
  const [reasons, setReasons] = useState<string[]>(
    dedupeCaseInsensitive(
      normalizeList(initialRehiringReasons).length
        ? normalizeList(initialRehiringReasons)
        : [...DEFAULT_REHIRING_REASONS]
    )
  );

  const [newManager, setNewManager] = useState('');
  const [newSalary, setNewSalary] = useState('');
  const [newReason, setNewReason] = useState('');

  const [managerSearch, setManagerSearch] = useState('');
  const [salarySearch, setSalarySearch] = useState('');
  const [reasonSearch, setReasonSearch] = useState('');

  const filteredManagers = useMemo(
    () => managers.filter((value) => value.toLowerCase().includes(managerSearch.trim().toLowerCase())),
    [managerSearch, managers]
  );
  const filteredSalaryOptions = useMemo(
    () => salaryOptions.filter((value) => value.toLowerCase().includes(salarySearch.trim().toLowerCase())),
    [salaryOptions, salarySearch]
  );
  const filteredReasons = useMemo(
    () => reasons.filter((value) => value.toLowerCase().includes(reasonSearch.trim().toLowerCase())),
    [reasonSearch, reasons]
  );

  async function persistDefaults(nextManagers: string[], nextSalaryOptions: string[], nextReasons: string[]) {
    if (saving) return true;
    setSaving(true);
    setErrorNotice(null);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          show_filled_first_names: initialShowFilled,
          disable_new_signups: initialDisableSignups,
          reports_to_options: dedupeCaseInsensitive(normalizeList(nextManagers)),
          salary_benefit_options: dedupeCaseInsensitive(normalizeList(nextSalaryOptions)),
          rehiring_reasons: dedupeCaseInsensitive(normalizeList(nextReasons))
        })
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrorNotice(body?.error || 'Failed to save defaults.');
        return false;
      }

      const savedManagers = Array.isArray(body?.reports_to_options) ? body.reports_to_options : nextManagers;
      const savedSalaryOptions = Array.isArray(body?.salary_benefit_options) ? body.salary_benefit_options : nextSalaryOptions;
      const savedReasons = Array.isArray(body?.rehiring_reasons) ? body.rehiring_reasons : nextReasons;

      setManagers(dedupeCaseInsensitive(normalizeList(savedManagers)));
      setSalaryOptions(dedupeCaseInsensitive(normalizeSalaryBenefitOptions(normalizeList(savedSalaryOptions))));
      setReasons(
        dedupeCaseInsensitive(
          normalizeList(savedReasons).length ? normalizeList(savedReasons) : [...DEFAULT_REHIRING_REASONS]
        )
      );
      return true;
    } catch {
      setErrorNotice('Network error while saving defaults.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addManager() {
    const trimmed = newManager.trim();
    if (!trimmed) return;
    if (managers.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return;
    const nextManagers = [trimmed, ...managers];
    const prevManagers = managers;
    setManagers(nextManagers);
    setNewManager('');
    const ok = await persistDefaults(nextManagers, salaryOptions, reasons);
    if (!ok) setManagers(prevManagers);
  }

  async function removeManager(value: string) {
    const nextManagers = managers.filter((item) => item !== value);
    const prevManagers = managers;
    setManagers(nextManagers);
    const ok = await persistDefaults(nextManagers, salaryOptions, reasons);
    if (!ok) setManagers(prevManagers);
  }

  async function addSalary() {
    const trimmed = newSalary.trim();
    if (!trimmed) return;
    if (salaryOptions.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return;
    const nextSalaryOptions = [trimmed, ...salaryOptions];
    const prevSalaryOptions = salaryOptions;
    setSalaryOptions(nextSalaryOptions);
    setNewSalary('');
    const ok = await persistDefaults(managers, nextSalaryOptions, reasons);
    if (!ok) setSalaryOptions(prevSalaryOptions);
  }

  async function removeSalary(value: string) {
    const nextSalaryOptions = salaryOptions.filter((item) => item !== value);
    const prevSalaryOptions = salaryOptions;
    setSalaryOptions(nextSalaryOptions);
    const ok = await persistDefaults(managers, nextSalaryOptions, reasons);
    if (!ok) setSalaryOptions(prevSalaryOptions);
  }

  async function addReason() {
    const trimmed = newReason.trim();
    if (!trimmed) return;
    if (reasons.some((item) => item.toLowerCase() === trimmed.toLowerCase())) return;
    const nextReasons = [trimmed, ...reasons];
    const prevReasons = reasons;
    setReasons(nextReasons);
    setNewReason('');
    const ok = await persistDefaults(managers, salaryOptions, nextReasons);
    if (!ok) setReasons(prevReasons);
  }

  async function removeReason(value: string) {
    const nextReasons = reasons.filter((item) => item !== value);
    const prevReasons = reasons;
    setReasons(nextReasons);
    const ok = await persistDefaults(managers, salaryOptions, nextReasons);
    if (!ok) setReasons(prevReasons);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-slate-300 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('managers')}
              className={`inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold ${
                activeTab === 'managers'
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Hiring Managers ({managers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('salary')}
              className={`inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold ${
                activeTab === 'salary'
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Salary &amp; Benefits ({salaryOptions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('reasons')}
              className={`inline-flex h-8 items-center rounded-md px-3 text-xs font-semibold ${
                activeTab === 'reasons'
                  ? 'bg-blue-600 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Re-Hiring Reasons ({reasons.length})
            </button>
          </div>
          <p className="text-xs text-slate-500">{saving ? 'Saving...' : 'Changes save automatically'}</p>
        </div>
      </section>

      {errorNotice ? (
        <p className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorNotice}</p>
      ) : null}

      <section className="rounded-md border border-slate-300 bg-white p-4">
        {activeTab === 'managers' ? (
          <div className="space-y-3">
            <input
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              placeholder="Search managers..."
              value={managerSearch}
              onChange={(event) => setManagerSearch(event.currentTarget.value)}
            />
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Add hiring manager"
                value={newManager}
                onChange={(event) => setNewManager(event.currentTarget.value)}
              />
              <button
                type="button"
                onClick={() => void addManager()}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Add
              </button>
            </div>
            <div className="max-h-[34rem] space-y-2 overflow-auto rounded-md border border-slate-200 p-2">
              {filteredManagers.map((manager) => (
                <div key={manager} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2">
                  <p className="truncate text-sm text-slate-700">{manager}</p>
                  <button
                    type="button"
                    onClick={() => void removeManager(manager)}
                    disabled={saving}
                    className="inline-flex h-7 items-center rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {!filteredManagers.length ? <p className="px-1 py-2 text-sm text-slate-500">No matching managers.</p> : null}
            </div>
          </div>
        ) : null}

        {activeTab === 'salary' ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Add salary + benefits default"
                value={newSalary}
                onChange={(event) => setNewSalary(event.currentTarget.value)}
              />
              <button
                type="button"
                onClick={() => void addSalary()}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Add
              </button>
            </div>
            <input
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              placeholder="Search salary defaults..."
              value={salarySearch}
              onChange={(event) => setSalarySearch(event.currentTarget.value)}
            />
            <div className="max-h-[34rem] space-y-2 overflow-auto rounded-md border border-slate-200 p-2">
              {filteredSalaryOptions.map((option) => (
                <div key={option} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2">
                  <p className="truncate text-sm text-slate-700">{option}</p>
                  <button
                    type="button"
                    onClick={() => void removeSalary(option)}
                    disabled={saving}
                    className="inline-flex h-7 items-center rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {!filteredSalaryOptions.length ? <p className="px-1 py-2 text-sm text-slate-500">No matching salary defaults.</p> : null}
            </div>
          </div>
        ) : null}

        {activeTab === 'reasons' ? (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                className="h-10 rounded-md border border-slate-300 px-3 text-sm"
                placeholder="Add re-hiring reason"
                value={newReason}
                onChange={(event) => setNewReason(event.currentTarget.value)}
              />
              <button
                type="button"
                onClick={() => void addReason()}
                disabled={saving}
                className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Add
              </button>
            </div>
            <input
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
              placeholder="Search re-hiring reasons..."
              value={reasonSearch}
              onChange={(event) => setReasonSearch(event.currentTarget.value)}
            />
            <div className="max-h-[34rem] space-y-2 overflow-auto rounded-md border border-slate-200 p-2">
              {filteredReasons.map((reason) => (
                <div key={reason} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-2">
                  <p className="truncate text-sm text-slate-700">{reason}</p>
                  <button
                    type="button"
                    onClick={() => void removeReason(reason)}
                    disabled={saving}
                    className="inline-flex h-7 items-center rounded-md border border-slate-300 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Remove
                  </button>
                </div>
              ))}
              {!filteredReasons.length ? <p className="px-1 py-2 text-sm text-slate-500">No matching re-hiring reasons.</p> : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
