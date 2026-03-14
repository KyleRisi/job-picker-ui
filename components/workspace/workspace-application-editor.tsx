'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Q1_OPTIONS, Q2_OPTIONS, Q3_OPTIONS } from '@/lib/constants';

type ApplicationData = {
  id: string;
  full_name: string;
  email: string;
  q1: string;
  q2: string;
  q3: string;
  day_to_day: string;
  incidents: string;
  kpi_assessment: string;
  consent_read_on_show: boolean;
  profile_photo_data_url?: string | null;
};

const QUESTIONS = {
  q1: 'How would you describe your general approach to responsibility?',
  q2: 'In a crisis, you are most likely to…',
  q3: 'Who is your favourite host?'
} as const;

export function WorkspaceApplicationEditor({ application }: { application: ApplicationData }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [data, setData] = useState(application);
  const textareasRef = useRef<Record<string, HTMLTextAreaElement | null>>({});

  function autoResize(element: HTMLTextAreaElement | null) {
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }

  function bindAutoResize(name: string) {
    return (element: HTMLTextAreaElement | null) => {
      textareasRef.current[name] = element;
      autoResize(element);
    };
  }

  useEffect(() => {
    autoResize(textareasRef.current.day_to_day || null);
    autoResize(textareasRef.current.incidents || null);
    autoResize(textareasRef.current.kpi_assessment || null);
  }, [data.day_to_day, data.incidents, data.kpi_assessment]);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setIsError(false);

    const payload = {
      full_name: `${data.full_name || ''}`.trim(),
      email: `${data.email || ''}`.trim(),
      q1: `${data.q1 || ''}`,
      q2: `${data.q2 || ''}`,
      q3: `${data.q3 || ''}`,
      day_to_day: `${data.day_to_day || ''}`,
      incidents: `${data.incidents || ''}`,
      kpi_assessment: `${data.kpi_assessment || ''}`,
      consent_read_on_show: Boolean(data.consent_read_on_show)
    };

    const response = await fetch(`/api/admin/applications/${application.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(body.error || 'Failed to save changes.');
      setIsError(true);
      setSaving(false);
      return;
    }

    setData((previous) => ({ ...previous, ...payload }));
    setMessage('Application updated.');
    setIsError(false);
    setSaving(false);
    router.refresh();
  }

  const inputClassName = 'h-10 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900';
  const textareaClassName = 'min-h-28 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900';

  return (
    <div className="space-y-4">
      <form className="space-y-4" onSubmit={onSave}>
        <section className="rounded-md border border-slate-300 bg-white p-4 sm:p-5">
          <h3 className="text-lg font-semibold text-slate-900">Personal Details</h3>
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="full_name">Full name</label>
              <input
                id="full_name"
                name="full_name"
                className={inputClassName}
                value={data.full_name || ''}
                onChange={(event) => setData((previous) => ({ ...previous, full_name: event.target.value }))}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="email">Email address</label>
              <input
                id="email"
                name="email"
                type="email"
                className={inputClassName}
                value={data.email || ''}
                onChange={(event) => setData((previous) => ({ ...previous, email: event.target.value }))}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="q1">{QUESTIONS.q1}</label>
              <select
                id="q1"
                name="q1"
                className={inputClassName}
                value={data.q1 || ''}
                onChange={(event) => setData((previous) => ({ ...previous, q1: event.target.value }))}
              >
                <option value="">Select an option</option>
                {Q1_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="q2">{QUESTIONS.q2}</label>
              <select
                id="q2"
                name="q2"
                className={inputClassName}
                value={data.q2 || ''}
                onChange={(event) => setData((previous) => ({ ...previous, q2: event.target.value }))}
              >
                <option value="">Select an option</option>
                {Q2_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
            <fieldset className="space-y-2 rounded-md border border-slate-300 p-3">
              <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-600">{QUESTIONS.q3}</legend>
              {Q3_OPTIONS.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="q3"
                    value={option}
                    checked={data.q3 === option}
                    onChange={(event) => setData((previous) => ({ ...previous, q3: event.target.value }))}
                  />
                  {option}
                </label>
              ))}
            </fieldset>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-slate-300 bg-white p-4 sm:p-5">
          <h3 className="text-lg font-semibold text-slate-900">Job Description</h3>
          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="day_to_day">Day-to-day responsibilities</label>
              <textarea
                ref={bindAutoResize('day_to_day')}
                id="day_to_day"
                name="day_to_day"
                className={textareaClassName}
                value={data.day_to_day || ''}
                onChange={(event) => setData((previous) => ({ ...previous, day_to_day: event.target.value }))}
                onInput={(event) => autoResize(event.currentTarget)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="incidents">Major incidents / near misses / cover-ups</label>
              <textarea
                ref={bindAutoResize('incidents')}
                id="incidents"
                name="incidents"
                className={textareaClassName}
                value={data.incidents || ''}
                onChange={(event) => setData((previous) => ({ ...previous, incidents: event.target.value }))}
                onInput={(event) => autoResize(event.currentTarget)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600" htmlFor="kpi_assessment">KPI self-assessment</label>
              <textarea
                ref={bindAutoResize('kpi_assessment')}
                id="kpi_assessment"
                name="kpi_assessment"
                className={textareaClassName}
                value={data.kpi_assessment || ''}
                onChange={(event) => setData((previous) => ({ ...previous, kpi_assessment: event.target.value }))}
                onInput={(event) => autoResize(event.currentTarget)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="consent_read_on_show"
                checked={data.consent_read_on_show}
                onChange={(event) => setData((previous) => ({ ...previous, consent_read_on_show: event.target.checked }))}
              />
              I consent to be featured on the show.
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex h-9 items-center justify-center rounded-md bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </section>
      </form>

      {message ? (
        <p className={`rounded-md border px-3 py-2 text-sm ${isError ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-emerald-300 bg-emerald-50 text-emerald-700'}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
