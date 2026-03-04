'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeSalaryBenefitOptions } from '@/lib/job-salary';
import { DEFAULT_REHIRING_REASONS } from '@/lib/constants';

export function AdminSettingsForm({
  showFilled,
  disableSignups,
  reportsToOptions,
  salaryBenefitOptions,
  rehiringReasons
}: {
  showFilled: boolean;
  disableSignups: boolean;
  reportsToOptions: string[];
  salaryBenefitOptions: string[];
  rehiringReasons: string[];
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [activeDefaultsTab, setActiveDefaultsTab] = useState<'managers' | 'salary' | 'reasons'>('managers');
  const [managers, setManagers] = useState<string[]>(reportsToOptions.length ? reportsToOptions : []);
  const [salaryOptions, setSalaryOptions] = useState<string[]>(normalizeSalaryBenefitOptions(salaryBenefitOptions));
  const [reasons, setReasons] = useState<string[]>(
    rehiringReasons.length ? rehiringReasons : [...DEFAULT_REHIRING_REASONS]
  );
  const [managerSearch, setManagerSearch] = useState('');
  const [salarySearch, setSalarySearch] = useState('');
  const [reasonSearch, setReasonSearch] = useState('');
  const [newManager, setNewManager] = useState('');
  const [newSalary, setNewSalary] = useState('');
  const [newReason, setNewReason] = useState('');

  function addManager() {
    const value = newManager.trim();
    if (!value) return;
    if (managers.some((m) => m.toLowerCase() === value.toLowerCase())) return;
    setManagers((prev) => [...prev, value]);
    setNewManager('');
  }

  function addSalaryOption() {
    const value = newSalary.trim();
    if (!value) return;
    if (salaryOptions.some((s) => s.toLowerCase() === value.toLowerCase())) return;
    setSalaryOptions((prev) => [...prev, value]);
    setNewSalary('');
  }

  function removeManagerByValue(value: string) {
    setManagers((prev) => prev.filter((item) => item !== value));
  }

  function removeSalaryByValue(value: string) {
    setSalaryOptions((prev) => prev.filter((item) => item !== value));
  }

  function addReason() {
    const value = newReason.trim();
    if (!value) return;
    if (reasons.some((r) => r.toLowerCase() === value.toLowerCase())) return;
    setReasons((prev) => [...prev, value]);
    setNewReason('');
  }

  function removeReasonByValue(value: string) {
    setReasons((prev) => prev.filter((item) => item !== value));
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        show_filled_first_names: data.get('show_filled_first_names') === 'on',
        disable_new_signups: data.get('disable_new_signups') === 'on',
        reports_to_options: managers.map((v) => v.trim()).filter(Boolean),
        salary_benefit_options: salaryOptions.map((v) => v.trim()).filter(Boolean),
        rehiring_reasons: reasons.map((v) => v.trim()).filter(Boolean)
      })
    });
    const body = await res.json();
    setMessage(body.message || body.error || 'Saved');
    if (res.ok) {
      const savedManagers = Array.isArray(body.reports_to_options)
        ? body.reports_to_options.map((v: unknown) => `${v}`.trim()).filter(Boolean)
        : managers.map((v) => v.trim()).filter(Boolean);
      const savedSalaryOptions = Array.isArray(body.salary_benefit_options)
        ? body.salary_benefit_options.map((v: unknown) => `${v}`.trim()).filter(Boolean)
        : salaryOptions.map((v) => v.trim()).filter(Boolean);
      const savedReasons = Array.isArray(body.rehiring_reasons)
        ? body.rehiring_reasons.map((v: unknown) => `${v}`.trim()).filter(Boolean)
        : reasons.map((v) => v.trim()).filter(Boolean);
      setManagers(savedManagers);
      setSalaryOptions(savedSalaryOptions.length ? savedSalaryOptions : normalizeSalaryBenefitOptions([]));
      setReasons(savedReasons);
      router.replace(`/admin/settings?updated=${Date.now()}`);
      router.refresh();
    }
  }

  const filteredManagers = managers.filter((m) => m.toLowerCase().includes(managerSearch.trim().toLowerCase()));
  const filteredSalaryOptions = salaryOptions.filter((s) => s.toLowerCase().includes(salarySearch.trim().toLowerCase()));
  const filteredReasons = reasons.filter((r) => r.toLowerCase().includes(reasonSearch.trim().toLowerCase()));

  return (
    <form className="space-y-4" onSubmit={submit}>
      <section className="card space-y-3">
        <h2 className="text-xl font-bold">Portal settings</h2>
        <label className="flex gap-2 items-center">
          <input type="checkbox" name="show_filled_first_names" defaultChecked={showFilled} />
          Show abbreviated filled names on public jobs page (First name + last initial)
        </label>
        <label className="flex gap-2 items-center">
          <input type="checkbox" name="disable_new_signups" defaultChecked={disableSignups} />
          Disable new sign-ups (block magic links for brand-new auth users)
        </label>
      </section>

      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Defaults</h2>
          <p className="text-sm text-carnival-ink/70">Used for job create/edit/import flows</p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className={activeDefaultsTab === 'managers' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActiveDefaultsTab('managers')}
          >
            Hiring Managers ({managers.length})
          </button>
          <button
            type="button"
            className={activeDefaultsTab === 'salary' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActiveDefaultsTab('salary')}
          >
            Salary & Benefits ({salaryOptions.length})
          </button>
          <button
            type="button"
            className={activeDefaultsTab === 'reasons' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setActiveDefaultsTab('reasons')}
          >
            Re-Hiring Reasons ({reasons.length})
          </button>
        </div>

        {activeDefaultsTab === 'managers' ? (
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                className="input"
                placeholder="Add hiring manager"
                value={newManager}
                onChange={(e) => setNewManager(e.target.value)}
              />
              <button type="button" className="btn-secondary" onClick={addManager}>Add</button>
            </div>
            <input
              className="input"
              placeholder="Search managers..."
              value={managerSearch}
              onChange={(e) => setManagerSearch(e.target.value)}
            />
            <div className="max-h-80 space-y-2 overflow-auto pr-1">
              {filteredManagers.map((manager) => (
                <div key={manager} className="flex items-center justify-between gap-2 rounded-md border border-carnival-ink/20 p-2">
                  <p className="truncate">{manager}</p>
                  <button type="button" className="btn-secondary" onClick={() => removeManagerByValue(manager)}>
                    Remove
                  </button>
                </div>
              ))}
              {!filteredManagers.length ? (
                <p className="text-sm text-carnival-ink/70">No matching managers.</p>
              ) : null}
            </div>
          </div>
        ) : activeDefaultsTab === 'salary' ? (
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                className="input"
                placeholder="Add salary + benefits default"
                value={newSalary}
                onChange={(e) => setNewSalary(e.target.value)}
              />
              <button type="button" className="btn-secondary" onClick={addSalaryOption}>Add</button>
            </div>
            <input
              className="input"
              placeholder="Search salary defaults..."
              value={salarySearch}
              onChange={(e) => setSalarySearch(e.target.value)}
            />
            <div className="max-h-80 space-y-2 overflow-auto pr-1">
              {filteredSalaryOptions.map((salary) => (
                <div key={salary} className="flex items-center justify-between gap-2 rounded-md border border-carnival-ink/20 p-2">
                  <p className="truncate">{salary}</p>
                  <button type="button" className="btn-secondary" onClick={() => removeSalaryByValue(salary)}>
                    Remove
                  </button>
                </div>
              ))}
              {!filteredSalaryOptions.length ? (
                <p className="text-sm text-carnival-ink/70">No matching salary defaults.</p>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                className="input"
                placeholder="Add re-hiring reason"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
              />
              <button type="button" className="btn-secondary" onClick={addReason}>Add</button>
            </div>
            <input
              className="input"
              placeholder="Search re-hiring reasons..."
              value={reasonSearch}
              onChange={(e) => setReasonSearch(e.target.value)}
            />
            <div className="max-h-80 space-y-2 overflow-auto pr-1">
              {filteredReasons.map((reason) => (
                <div key={reason} className="flex items-center justify-between gap-2 rounded-md border border-carnival-ink/20 p-2">
                  <p className="truncate">{reason}</p>
                  <button type="button" className="btn-secondary" onClick={() => removeReasonByValue(reason)}>
                    Remove
                  </button>
                </div>
              ))}
              {!filteredReasons.length ? (
                <p className="text-sm text-carnival-ink/70">No matching re-hiring reasons.</p>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <div className="flex items-center gap-2 rounded-lg border border-carnival-ink/20 bg-white p-3 shadow-card">
        <button className="btn-primary" type="submit">Save settings</button>
        {message ? (
          <p className="rounded-md bg-blue-100 px-3 py-2 text-sm">{message}</p>
        ) : (
          <p className="text-sm text-carnival-ink/70">Remember to save after edits.</p>
        )}
      </div>
    </form>
  );
}
