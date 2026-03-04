'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Q1_OPTIONS, Q2_OPTIONS, Q3_OPTIONS } from '@/lib/constants';
import {
  EXIT_Q1_LABEL,
  EXIT_Q1_OPTIONS,
  EXIT_Q2_LABEL,
  EXIT_Q2_OPTIONS,
  EXIT_Q3_LABEL,
  EXIT_Q3_OPTIONS
} from '@/lib/constants';

type Props = {
  assignmentId: string;
  initialFullName: string;
  initialEmail: string;
  jobTitle: string;
  q1: string;
  q2: string;
  q3: string;
  consentReadOnShow: boolean;
  dayToDay: string;
  incidents: string;
  kpi: string;
  accessEmail: string;
  accessRef: string;
};

export function HrFileForm(props: Props) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [resignOpen, setResignOpen] = useState(false);
  const [resignMsg, setResignMsg] = useState('');
  const [accessEmailForAuth, setAccessEmailForAuth] = useState(props.accessEmail);
  const [validationHeading, setValidationHeading] = useState('');
  const [validationItems, setValidationItems] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});

  async function saveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setValidationHeading('');
    setValidationItems([]);
    setFieldErrors({});
    setMessage('');
    setSaved(false);

    const formData = new FormData(e.currentTarget);
    const fullName = `${formData.get('fullName') || ''}`.trim();
    const email = `${formData.get('email') || ''}`.trim();
    const q1 = `${formData.get('q1') || ''}`.trim();
    const q2 = `${formData.get('q2') || ''}`.trim();
    const q3 = `${formData.get('q3') || ''}`.trim();
    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const missing: string[] = [];
    const nextFieldErrors: Record<string, boolean> = {};
    if (!fullName) {
      missing.push('Full name');
      nextFieldErrors.fullName = true;
    }
    if (!email) {
      missing.push('Email address');
      nextFieldErrors.email = true;
    } else if (!emailValid) {
      missing.push('A valid email address');
      nextFieldErrors.email = true;
    }
    if (!q1) {
      missing.push('Question 1: Responsibility approach');
      nextFieldErrors.q1 = true;
    }
    if (!q2) {
      missing.push('Question 2: Crisis response');
      nextFieldErrors.q2 = true;
    }
    if (!q3) {
      missing.push('Question 3: Favourite host');
      nextFieldErrors.q3 = true;
    }

    if (missing.length) {
      setValidationHeading('Before saving, please complete this:');
      setValidationItems(missing);
      setFieldErrors(nextFieldErrors);
      return;
    }

    setSaving(true);
    try {
      const payload = Object.fromEntries(formData.entries());
      const res = await fetch('/api/my-job/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: props.assignmentId,
          accessEmail: accessEmailForAuth,
          accessRef: props.accessRef,
          ...payload
        })
      });

      const bodyText = await res.text();
      let data: { message?: string; error?: string } = {};
      try {
        data = bodyText ? JSON.parse(bodyText) : {};
      } catch {
        data = {};
      }

      setMessage(data.message || data.error || (res.ok ? 'Updated.' : 'Could not save updates.'));
      if (res.ok) {
        setSaved(true);
        const nextEmail = `${formData.get('email') || ''}`.trim().toLowerCase();
        if (nextEmail) setAccessEmailForAuth(nextEmail);
        router.refresh();
      }
    } catch {
      setMessage('Could not save updates due to a network or server error.');
    } finally {
      setSaving(false);
    }
  }

  async function resign(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.currentTarget).entries());
    const res = await fetch('/api/my-job/resign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assignmentId: props.assignmentId,
        accessEmail: props.accessEmail,
        accessRef: props.accessRef,
        ...payload
      })
    });
    const data = await res.json();
    if (res.ok) {
      window.location.href = '/jobs';
      return;
    } else {
      setResignMsg(data.error || 'Resignation failed.');
    }
  }

  return (
    <div className="space-y-6">
      {validationItems.length ? (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-semibold">{validationHeading}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {validationItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-2 text-xs">
            You can come back later to complete your full job description if you&apos;re not ready to do so just yet.
          </p>
        </div>
      ) : null}
      <form className="space-y-4" onSubmit={saveProfile} noValidate>
        <section className="card space-y-3">
          <h3 className="text-lg font-black text-carnival-ink">Personal Details</h3>
          <div>
            <label className="label" htmlFor="fullName">Full name</label>
            <input
              className={`input ${fieldErrors.fullName ? '!border-red-600 !bg-red-50' : ''}`}
              id="fullName"
              name="fullName"
              defaultValue={props.initialFullName}
              required
              aria-invalid={fieldErrors.fullName ? 'true' : 'false'}
            />
          </div>
          <div>
            <label className="label" htmlFor="email">Email address</label>
            <input
              className={`input ${fieldErrors.email ? '!border-red-600 !bg-red-50' : ''}`}
              id="email"
              name="email"
              type="email"
              defaultValue={props.initialEmail}
              required
              aria-invalid={fieldErrors.email ? 'true' : 'false'}
            />
          </div>
          <div>
            <label className="label" htmlFor="q1">How would you describe your general approach to responsibility?</label>
            <select
              className={`input ${fieldErrors.q1 ? '!border-red-600 !bg-red-50' : ''}`}
              id="q1"
              name="q1"
              defaultValue={props.q1 || ''}
              aria-invalid={fieldErrors.q1 ? 'true' : 'false'}
            >
              <option value="">Select an option</option>
              {Q1_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="q2">In a crisis, you are most likely to…</label>
            <select
              className={`input ${fieldErrors.q2 ? '!border-red-600 !bg-red-50' : ''}`}
              id="q2"
              name="q2"
              defaultValue={props.q2 || ''}
              aria-invalid={fieldErrors.q2 ? 'true' : 'false'}
            >
              <option value="">Select an option</option>
              {Q2_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <fieldset
            className={`space-y-2 rounded-md border p-3 ${
              fieldErrors.q3 ? 'border-red-600 bg-red-50' : 'border-carnival-ink/20'
            }`}
          >
            <legend className="label">Who is your favourite host?</legend>
            <div className="space-y-2">
              {Q3_OPTIONS.map((opt) => (
                <label key={opt} className="flex items-center gap-2">
                  <input type="radio" name="q3" value={opt} defaultChecked={props.q3 === opt} /> {opt}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex justify-end">
            <button
              className={saved ? 'btn bg-green-600 text-white hover:bg-green-700' : 'btn-primary'}
              disabled={saving}
              type="submit"
            >
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save updates'}
            </button>
          </div>
        </section>

        <section className="card space-y-3">
          <h3 className="text-lg font-black text-carnival-ink">Job Description</h3>
          <p><strong>Job title:</strong> {props.jobTitle || 'N/A'}</p>
          <div>
            <label className="label" htmlFor="dayToDay">Day-to-day responsibilities</label>
            <textarea className="input min-h-24" id="dayToDay" name="dayToDay" defaultValue={props.dayToDay} />
          </div>
          <div>
            <label className="label" htmlFor="incidents">Major incidents / near misses / cover-ups</label>
            <textarea className="input min-h-24" id="incidents" name="incidents" defaultValue={props.incidents} />
          </div>
          <div>
            <label className="label" htmlFor="kpiAssessment">KPI self-assessment</label>
            <textarea className="input min-h-24" id="kpiAssessment" name="kpiAssessment" defaultValue={props.kpi} />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="consentReadOnShow" defaultChecked={props.consentReadOnShow} />
            I consent to be featured on the show.
          </label>
          <div className="flex justify-end">
            <button
              className={saved ? 'btn bg-green-600 text-white hover:bg-green-700' : 'btn-primary'}
              disabled={saving}
              type="submit"
            >
              {saving ? 'Saving...' : saved ? 'Saved' : 'Save updates'}
            </button>
          </div>
        </section>
      </form>

      <section className="card">
        <h2 className="text-xl font-bold">Resign from role</h2>
        <p className="mt-2">Complete the exit interview to resign. You will be redirected to job listings afterwards.</p>
        <button className="btn-primary mt-4" type="button" onClick={() => setResignOpen((v) => !v)} aria-expanded={resignOpen}>
          {resignOpen ? 'Close exit interview' : 'Begin resignation'}
        </button>

        {resignOpen ? (
          <form className="mt-4 space-y-3" onSubmit={resign}>
            <div>
              <label className="label" htmlFor="exitQ1">{EXIT_Q1_LABEL}</label>
              <select className="input" id="exitQ1" name="exitQ1" required>
                <option value="">Select</option>
                {EXIT_Q1_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="exitQ2">{EXIT_Q2_LABEL}</label>
              <select className="input" id="exitQ2" name="exitQ2" required>
                <option value="">Select</option>
                {EXIT_Q2_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="exitQ3">{EXIT_Q3_LABEL}</label>
              <select className="input" id="exitQ3" name="exitQ3" required>
                <option value="">Select</option>
                {EXIT_Q3_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button className="btn-primary" type="submit">Confirm resignation</button>
              <button className="btn-secondary" type="button" onClick={() => setResignOpen(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}
        {resignMsg ? <p className="mt-2 rounded-md bg-blue-100 p-3">{resignMsg}</p> : null}
      </section>

      {message ? <p className="rounded-md bg-blue-100 p-3">{message}</p> : null}
    </div>
  );
}
