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

export function AdminApplicationEditor({ application }: { application: ApplicationData }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [data, setData] = useState(application);
  const textareasRef = useRef<Record<string, HTMLTextAreaElement | null>>({});

  function autoResize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }

  function bindAutoResize(name: string) {
    return (el: HTMLTextAreaElement | null) => {
      textareasRef.current[name] = el;
      autoResize(el);
    };
  }

  useEffect(() => {
    autoResize(textareasRef.current.day_to_day || null);
    autoResize(textareasRef.current.incidents || null);
    autoResize(textareasRef.current.kpi_assessment || null);
  }, [data.day_to_day, data.incidents, data.kpi_assessment]);

  async function onSave(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
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

    const res = await fetch(`/api/admin/applications/${application.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const body = await res.json();
    if (!res.ok) {
      setMessage(body.error || 'Failed to save changes.');
      setIsError(true);
      setSaving(false);
      return;
    }

    setData((prev) => ({ ...prev, ...payload }));
    setMessage('Application updated.');
    setIsError(false);
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form className="space-y-4" onSubmit={onSave}>
        <section className="card space-y-3">
          <h3 className="text-lg font-black text-carnival-ink">Personal Details</h3>
          <div>
            <label className="label" htmlFor="full_name">Full name</label>
            <input
              id="full_name"
              name="full_name"
              className="input"
              value={data.full_name || ''}
              onChange={(e) => setData((prev) => ({ ...prev, full_name: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              className="input"
              value={data.email || ''}
              onChange={(e) => setData((prev) => ({ ...prev, email: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="q1">{QUESTIONS.q1}</label>
            <select
              id="q1"
              name="q1"
              className="input"
              value={data.q1 || ''}
              onChange={(e) => setData((prev) => ({ ...prev, q1: e.target.value }))}
            >
              <option value="">Select an option</option>
              {Q1_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="q2">{QUESTIONS.q2}</label>
            <select
              id="q2"
              name="q2"
              className="input"
              value={data.q2 || ''}
              onChange={(e) => setData((prev) => ({ ...prev, q2: e.target.value }))}
            >
              <option value="">Select an option</option>
              {Q2_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <fieldset className="space-y-2 rounded-md border border-carnival-ink/20 p-3">
            <legend className="label px-1">{QUESTIONS.q3}</legend>
            {Q3_OPTIONS.map((opt) => (
              <label key={opt} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="q3"
                  value={opt}
                  checked={data.q3 === opt}
                  onChange={(e) => setData((prev) => ({ ...prev, q3: e.target.value }))}
                />
                {opt}
              </label>
            ))}
          </fieldset>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
          </div>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-black text-carnival-ink">Job Description</h3>
          <div>
            <label className="label" htmlFor="day_to_day">Day-to-day responsibilities</label>
            <textarea
              ref={bindAutoResize('day_to_day')}
              id="day_to_day"
              name="day_to_day"
              className="input min-h-28"
              value={data.day_to_day || ''}
              onChange={(e) => setData((prev) => ({ ...prev, day_to_day: e.target.value }))}
              onInput={(e) => autoResize(e.currentTarget)}
            />
          </div>
          <div>
            <label className="label" htmlFor="incidents">Major incidents / near misses / cover-ups</label>
            <textarea
              ref={bindAutoResize('incidents')}
              id="incidents"
              name="incidents"
              className="input min-h-28"
              value={data.incidents || ''}
              onChange={(e) => setData((prev) => ({ ...prev, incidents: e.target.value }))}
              onInput={(e) => autoResize(e.currentTarget)}
            />
          </div>
          <div>
            <label className="label" htmlFor="kpi_assessment">KPI self-assessment</label>
            <textarea
              ref={bindAutoResize('kpi_assessment')}
              id="kpi_assessment"
              name="kpi_assessment"
              className="input min-h-28"
              value={data.kpi_assessment || ''}
              onChange={(e) => setData((prev) => ({ ...prev, kpi_assessment: e.target.value }))}
              onInput={(e) => autoResize(e.currentTarget)}
            />
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="consent_read_on_show"
              checked={data.consent_read_on_show}
              onChange={(e) => setData((prev) => ({ ...prev, consent_read_on_show: e.target.checked }))}
            />
            I consent to be featured on the show.
          </label>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
          </div>
        </section>
      </form>

      {message ? (
        <p className={`rounded-md p-3 ${isError ? 'bg-red-100 text-red-900' : 'bg-blue-100 text-carnival-ink'}`}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
