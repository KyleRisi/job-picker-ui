'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Q1_OPTIONS, Q2_OPTIONS, Q3_OPTIONS } from '@/lib/constants';
import { identifyMixpanel, trackMixpanel } from '@/lib/mixpanel-browser';

export function ApplyForm({
  jobId,
  jobRef,
  jobTitle,
  jobDescription,
  jobStatus,
  salary,
  reportsTo
}: {
  jobId: string;
  jobRef: string;
  jobTitle: string;
  jobDescription: string;
  jobStatus: string;
  salary: string;
  reportsTo: string;
}) {
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [assignmentRef, setAssignmentRef] = useState('');
  const [showSavedModal, setShowSavedModal] = useState(false);
  const [savedEmail, setSavedEmail] = useState('');
  const [validationHeading, setValidationHeading] = useState('');
  const [validationItems, setValidationItems] = useState<string[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, boolean>>({});
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSrc, setEditorSrc] = useState('');
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const validationRef = useRef<HTMLDivElement | null>(null);
  const photoFileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!validationItems.length) return;
    validationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [validationItems.length]);

  function resetPhotoEditor() {
    setZoom(1);
    setRotation(0);
    setOffsetX(0);
    setOffsetY(0);
  }

  function closePhotoEditor() {
    setEditorOpen(false);
    setEditorSrc('');
    resetPhotoEditor();
  }

  async function renderEditedPhotoToDataUrl(): Promise<string> {
    if (!editorSrc) return '';
    const canvas = document.createElement('canvas');
    const outW = 360;
    const outH = 440;
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    const img = new window.Image();
    img.src = editorSrc;

    return new Promise<string>((resolve) => {
      img.onload = () => {
        ctx.clearRect(0, 0, outW, outH);
        ctx.save();
        ctx.translate(outW / 2 + offsetX, outH / 2 + offsetY);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.scale(zoom, zoom);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        ctx.restore();
        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => resolve('');
    });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    try {
      e.preventDefault();
      setLoading(true);
      setStatus('');
      setValidationHeading('');
      setValidationItems([]);
      setFieldErrors({});
      const formData = new FormData(e.currentTarget);
      const payload = Object.fromEntries(formData.entries());
      const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      const intent = submitter?.value === 'save_later' ? 'save_later' : 'submit';
      const fullName = `${payload.fullName || ''}`.trim();
      const email = `${payload.email || ''}`.trim();
      const q1 = `${payload.q1 || ''}`.trim();
      const q2 = `${payload.q2 || ''}`.trim();
      const q3 = `${payload.q3 || ''}`.trim();
      const dayToDay = `${payload.dayToDayResponsibilities || ''}`.trim();
      const incidents = `${payload.majorIncidentsNearMissesCoverUps || ''}`.trim();
      const kpi = `${payload.kpiSelfAssessment || ''}`.trim();
      const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

      const missingCore: string[] = [];
      const nextFieldErrors: Record<string, boolean> = {};
      if (!fullName) missingCore.push('Full name');
      if (!fullName) nextFieldErrors.fullName = true;
      if (!email) {
        missingCore.push('Email address');
        nextFieldErrors.email = true;
      } else if (!emailValid) {
        missingCore.push('A valid email address');
        nextFieldErrors.email = true;
      }
      if (!q1) missingCore.push('Question 1: Responsibility approach');
      if (!q1) nextFieldErrors.q1 = true;
      if (!q2) missingCore.push('Question 2: Crisis response');
      if (!q2) nextFieldErrors.q2 = true;
      if (!q3) missingCore.push('Question 3: Favourite host');
      if (!q3) nextFieldErrors.q3 = true;

      if (missingCore.length) {
        setValidationHeading(intent === 'save_later' ? 'Before saving, please complete this:' : 'Before submitting, please complete this:');
        setValidationItems(missingCore);
        setFieldErrors(nextFieldErrors);
        setLoading(false);
        return;
      }

      if (intent === 'submit' && (!dayToDay || !incidents || !kpi)) {
        const submitMissing: string[] = [];
        if (!dayToDay) {
          submitMissing.push('Day-to-day responsibilities');
          nextFieldErrors.dayToDayResponsibilities = true;
        }
        if (!incidents) {
          submitMissing.push('Major incidents / near misses / cover-ups');
          nextFieldErrors.majorIncidentsNearMissesCoverUps = true;
        }
        if (!kpi) {
          submitMissing.push('KPI self-assessment');
          nextFieldErrors.kpiSelfAssessment = true;
        }
        setValidationHeading('Before submitting, please complete this:');
        setValidationItems(submitMissing);
        setFieldErrors(nextFieldErrors);
        setLoading(false);
        return;
      }

      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          profilePhotoDataUrl: photoDataUrl,
          jobId,
          intent,
          assignmentRef: assignmentRef.trim() || undefined
        })
      });

      const contentType = res.headers.get('content-type') || '';
      const data = contentType.includes('application/json') ? await res.json() : null;

      if (!res.ok) {
        setStatus(data?.error || 'Application failed. Please try again.');
        setLoading(false);
        return;
      }

      if (intent === 'save_later') {
        if (data?.assignmentRef && typeof data.assignmentRef === 'string') {
          setAssignmentRef(data.assignmentRef);
        }
        setSavedEmail(`${payload.email || ''}`);
        setShowSavedModal(true);
        setStatus('');
        setValidationHeading('');
        setValidationItems([]);
        setFieldErrors({});
        setLoading(false);
        return;
      }

      setStatus('Application submitted! Use My Job if you need to update your profile later.');
      if (data?.assignmentRef && typeof data.assignmentRef === 'string') {
        setAssignmentRef(data.assignmentRef);
      }
      const trackedAssignmentRef = data?.assignmentRef && typeof data.assignmentRef === 'string'
        ? data.assignmentRef
        : assignmentRef;
      const trackedEmail = `${payload.email || ''}`.trim().toLowerCase();
      const userId = trackedAssignmentRef || trackedEmail;
      const utmParams = new URLSearchParams(window.location.search);
      trackMixpanel('Sign Up', {
        user_id: userId,
        email: trackedEmail,
        signup_method: 'application_form',
        utm_source: utmParams.get('utm_source') || '',
        utm_medium: utmParams.get('utm_medium') || '',
        utm_campaign: utmParams.get('utm_campaign') || ''
      });
      identifyMixpanel(userId, {
        $email: trackedEmail
      });
      setValidationHeading('');
      setValidationItems([]);
      setFieldErrors({});
      (e.target as HTMLFormElement).reset();
      setLoading(false);
      setTimeout(() => {
        const submittedEmail = `${payload.email || ''}`.trim();
        const editRef =
          (data?.assignmentRef && typeof data.assignmentRef === 'string' ? data.assignmentRef : assignmentRef) || '';
        const params = new URLSearchParams({
          applied: '1',
          jobTitle,
          jobRef,
          email: submittedEmail,
          jobId,
          assignmentRef: editRef
        });
        window.location.assign(`/jobs?${params.toString()}`);
      }, 600);
    } catch {
      setStatus('Application failed due to a server error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="card overflow-hidden p-0">
        <div className="bg-carnival-ink/5 p-6">
          <div className="mb-5 space-y-1 sm:flex sm:items-start sm:justify-between sm:space-y-0">
            <h2 className="hidden text-xl font-black text-carnival-ink sm:block">Job Application</h2>
            <div className="text-center sm:text-right">
              <p className="text-sm font-bold text-carnival-ink">
                <span className="font-black text-carnival-ink">
                  <span className="sm:hidden">JR:</span>
                  <span className="hidden sm:inline">Job reference:</span>
                </span>{' '}
                <span className="font-extrabold text-carnival-red">{jobRef}</span>
              </p>
              <div className="mt-2 flex justify-center sm:hidden">
                <span className="inline-flex rounded-full border border-emerald-300 bg-emerald-100 px-3 py-0.5 text-[0.72rem] font-black uppercase tracking-wide text-emerald-900">
                  Applying
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="shrink-0">
              <div
                className="group relative block h-44 w-36 cursor-pointer overflow-hidden rounded-lg border-2 border-carnival-ink/20 bg-white"
                onClick={() => photoFileRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    photoFileRef.current?.click();
                  }
                }}
              >
                {photoDataUrl ? (
                  <Image src={photoDataUrl} alt="Profile preview" fill sizes="144px" className="object-cover" unoptimized />
                ) : (
                  <Image src="/profile-placeholder.png" alt="Upload photo placeholder" fill sizes="144px" className="object-cover" />
                )}
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-carnival-ink/55 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                  {photoDataUrl ? (
                    <span className="pointer-events-auto flex flex-col items-center gap-2">
                      <button
                        type="button"
                        className="flex items-center gap-1 rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-carnival-ink"
                        onClick={(e) => {
                          e.stopPropagation();
                          photoFileRef.current?.click();
                        }}
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                          <path d="M9 3a1 1 0 0 0-.894.553L7.382 5H5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3h-2.382l-.724-1.447A1 1 0 0 0 15 3H9zm3 5a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
                        </svg>
                        Change photo
                      </button>
                      <button
                        type="button"
                        className="rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-carnival-ink"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPhotoDataUrl('');
                        }}
                      >
                        Remove photo
                      </button>
                    </span>
                  ) : (
                    <span className="rounded-md bg-white/90 px-2 py-1 text-xs font-semibold text-carnival-ink">
                      Change photo
                    </span>
                  )}
                </span>
                <input
                  ref={photoFileRef}
                  className="hidden"
                  id="profilePhotoHeader"
                  name="profilePhotoHeader"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const file = e.currentTarget.files?.[0];
                    setPhotoError('');
                    if (!file) {
                      setPhotoDataUrl('');
                      return;
                    }
                    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
                      setPhotoDataUrl('');
                      setPhotoError('Please upload PNG, JPG, or WEBP.');
                      return;
                    }
                    if (file.size > 1_500_000) {
                      setPhotoDataUrl('');
                      setPhotoError('Please keep image size under 1.5MB.');
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      const result = `${reader.result || ''}`;
                      const dataUrl = result.startsWith('data:image/') ? result : '';
                      if (!dataUrl) {
                        setPhotoError('Could not read image file.');
                        return;
                      }
                      setEditorSrc(dataUrl);
                      resetPhotoEditor();
                      setEditorOpen(true);
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </div>
            </div>
            <div className="min-w-0">
              <h1 className="text-[1.55rem] font-black leading-[1.08] text-carnival-ink sm:text-[1.95rem] md:text-[2.3rem]">{jobTitle}</h1>
              <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-carnival-ink/80">{jobDescription}</p>
            </div>
          </div>
          {photoError ? (
            <div className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
              <p className="font-semibold">Couldn&apos;t use that photo.</p>
              <p className="mt-1">{photoError}</p>
            </div>
          ) : null}
          <div className="mt-4 border-t border-carnival-ink/10 pt-3">
            <div className="flex flex-col gap-2 text-sm text-carnival-ink/85 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
                <p><strong>Salary:</strong> {salary}</p>
                <p><strong>Reports to:</strong> {reportsTo}</p>
              </div>
              <span className="hidden rounded-full border border-emerald-300 bg-emerald-100 px-3 py-0.5 text-[0.72rem] font-black uppercase tracking-wide text-emerald-900 sm:inline-flex">
                Applying
              </span>
            </div>
          </div>
        </div>
      </div>

      {editorOpen ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-black text-carnival-ink">Adjust Photo</h3>
              <button type="button" className="btn-secondary" onClick={closePhotoEditor}>
                Close
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-[auto,1fr]">
              <div className="relative mx-auto h-[264px] w-[216px] overflow-hidden rounded-lg border-2 border-carnival-ink/20 bg-carnival-cream/40">
                <Image
                  src={editorSrc}
                  alt="Photo edit preview"
                  fill
                  sizes="216px"
                  className="select-none object-cover"
                  unoptimized
                  style={{
                    transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'center center'
                  }}
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="label" htmlFor="zoomApply">Zoom</label>
                  <input
                    id="zoomApply"
                    type="range"
                    min={1}
                    max={3}
                    step={0.01}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.currentTarget.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="rotationApply">Rotate</label>
                  <input
                    id="rotationApply"
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.currentTarget.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="offsetXApply">Move left / right</label>
                  <input
                    id="offsetXApply"
                    type="range"
                    min={-220}
                    max={220}
                    step={1}
                    value={offsetX}
                    onChange={(e) => setOffsetX(Number(e.currentTarget.value))}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="offsetYApply">Move up / down</label>
                  <input
                    id="offsetYApply"
                    type="range"
                    min={-220}
                    max={220}
                    step={1}
                    value={offsetY}
                    onChange={(e) => setOffsetY(Number(e.currentTarget.value))}
                    className="w-full"
                  />
                </div>
                <div className="flex flex-wrap justify-end gap-2 pt-2">
                  <button type="button" className="btn-secondary" onClick={resetPhotoEditor}>
                    Reset
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={async () => {
                      const edited = await renderEditedPhotoToDataUrl();
                      if (!edited) {
                        setPhotoError('Could not process image.');
                        return;
                      }
                      setPhotoDataUrl(edited);
                      closePhotoEditor();
                    }}
                  >
                    Use photo
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {validationItems.length ? (
        <div ref={validationRef} className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
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
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <section className="card space-y-4">
        <h2 className="text-xl font-black text-carnival-ink">Personal Details</h2>
        <div>
          <label className="label" htmlFor="fullName">
            Full name
          </label>
          <input
            className={`input ${fieldErrors.fullName ? '!border-red-600 !bg-red-50' : ''}`}
            id="fullName"
            name="fullName"
            required
            aria-invalid={fieldErrors.fullName ? 'true' : 'false'}
          />
        </div>
        <div>
          <label className="label" htmlFor="email">
            Email address
          </label>
          <input
            className={`input ${fieldErrors.email ? '!border-red-600 !bg-red-50' : ''}`}
            id="email"
            name="email"
            type="email"
            required
            aria-invalid={fieldErrors.email ? 'true' : 'false'}
          />
        </div>

        <div>
          <label className="label" htmlFor="q1">
            How would you describe your general approach to responsibility?
          </label>
          <select
            className={`input ${fieldErrors.q1 ? '!border-red-600 !bg-red-50' : ''}`}
            id="q1"
            name="q1"
            required
            aria-invalid={fieldErrors.q1 ? 'true' : 'false'}
          >
            <option value="">Select an option</option>
            {Q1_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="q2">
            In a crisis, you are most likely to…
          </label>
          <select
            className={`input ${fieldErrors.q2 ? '!border-red-600 !bg-red-50' : ''}`}
            id="q2"
            name="q2"
            required
            aria-invalid={fieldErrors.q2 ? 'true' : 'false'}
          >
            <option value="">Select an option</option>
            {Q2_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <fieldset className={fieldErrors.q3 ? 'rounded-md border border-red-600 bg-red-50 p-3' : ''}>
          <legend className="label">Who is your favourite host?</legend>
          <div className="space-y-2">
            {Q3_OPTIONS.map((opt) => (
              <label key={opt} className="flex items-center gap-2">
                <input type="radio" name="q3" value={opt} required /> {opt}
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="card space-y-4">
        <h2 className="text-xl font-black text-carnival-ink">Job Description</h2>
        <div>
          <label className="label" htmlFor="dayToDayResponsibilities">
            Day-to-day responsibilities
          </label>
          <textarea
            className={`input min-h-28 ${fieldErrors.dayToDayResponsibilities ? '!border-red-600 !bg-red-50' : ''}`}
            id="dayToDayResponsibilities"
            name="dayToDayResponsibilities"
            aria-invalid={fieldErrors.dayToDayResponsibilities ? 'true' : 'false'}
          />
        </div>

        <div>
          <label className="label" htmlFor="majorIncidentsNearMissesCoverUps">
            Major incidents / near misses / cover-ups
          </label>
          <textarea
            className={`input min-h-28 ${fieldErrors.majorIncidentsNearMissesCoverUps ? '!border-red-600 !bg-red-50' : ''}`}
            id="majorIncidentsNearMissesCoverUps"
            name="majorIncidentsNearMissesCoverUps"
            aria-invalid={fieldErrors.majorIncidentsNearMissesCoverUps ? 'true' : 'false'}
          />
        </div>

        <div>
          <label className="label" htmlFor="kpiSelfAssessment">
            KPI self-assessment
          </label>
          <textarea
            className={`input min-h-28 ${fieldErrors.kpiSelfAssessment ? '!border-red-600 !bg-red-50' : ''}`}
            id="kpiSelfAssessment"
            name="kpiSelfAssessment"
            aria-invalid={fieldErrors.kpiSelfAssessment ? 'true' : 'false'}
          />
        </div>

        <label className="flex items-center gap-2">
          <input type="checkbox" name="consentReadOnShow" /> I consent to be featured on the show.
        </label>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:flex-wrap sm:justify-start">
            <button className="btn-secondary" disabled={loading} type="submit" value="save_later">
              {loading ? 'Saving...' : 'Save'}
            </button>
            <Link href="/jobs?tab=available" className="btn-secondary ml-auto sm:ml-0">
              Cancel
            </Link>
          </div>
          <button className="btn-primary sm:ml-auto" disabled={loading} type="submit" value="submit">
            {loading ? 'Submitting...' : 'Submit application'}
          </button>
        </div>
      </section>
      {status ? (
        <p className={`rounded-md p-3 ${status.includes('submitted') ? 'bg-green-100' : 'bg-red-100'}`}>{status}</p>
      ) : null}
      {showSavedModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-xl rounded-xl border border-carnival-ink/20 bg-white p-5 shadow-xl">
            <h3 className="text-xl font-black text-carnival-ink">Saved. Finish your application later.</h3>
            <p className="mt-2 text-sm text-carnival-ink/80">
              When you&apos;re ready to submit, go to <strong>My Job</strong>, enter your email and job number, then continue your updates.
            </p>
            <div className="mt-4 space-y-1 rounded-md bg-carnival-ink/5 p-3 text-sm">
              <p><strong>Email:</strong> {savedEmail || 'Use the email you entered'}</p>
              <p><strong>Job Number:</strong> {jobRef}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/my-job" className="btn-primary">Go to My Job</Link>
              <button type="button" className="btn-secondary" onClick={() => setShowSavedModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </form>
    </div>
  );
}
