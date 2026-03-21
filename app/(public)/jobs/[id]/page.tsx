import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getJobById } from '@/lib/data';
import { getDefaultSalaryBenefits } from '@/lib/job-salary';
import { JobContextReadMore } from '@/components/job-context-read-more';
import { StatusPill } from '@/components/status-pill';
import { ROBOTS_NOINDEX_FOLLOW, ROBOTS_NOINDEX_NOFOLLOW } from '@/lib/seo';
import { JobPageViewedTracker } from '@/components/jobs-analytics-trackers';
import { TrackedJobApplyLink } from '@/components/tracked-job-links';

function toMetaDescription(value: string): string {
  const normalized = `${value || ''}`.replace(/\s+/g, ' ').trim();
  if (!normalized) return 'Explore this role at The Compendium Podcast.';
  return normalized.length > 155 ? `${normalized.slice(0, 152).trimEnd()}...` : normalized;
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const job = await getJobById(params.id);

  if (!job) {
    return {
      title: 'Job Not Found',
      robots: ROBOTS_NOINDEX_NOFOLLOW
    };
  }

  const statusPrefix =
    job.status === 'FILLED' ? 'Filled role.' : job.status === 'REHIRING' ? 'Rehiring now.' : 'Now hiring.';
  const description = toMetaDescription(`${statusPrefix} ${job.description || ''}`);
  const canonicalPath = `/jobs/${job.id}`;
  const pageTitle = `${job.title} (${job.job_ref})`;

  return {
    title: pageTitle,
    description,
    robots: ROBOTS_NOINDEX_FOLLOW,
    alternates: {
      canonical: canonicalPath
    },
    openGraph: {
      title: `${job.title} | The Compendium Podcast`,
      description,
      url: canonicalPath
    },
    twitter: {
      card: 'summary_large_image',
      title: `${job.title} | The Compendium Podcast`,
      description
    },
    keywords: [
      job.title,
      job.job_ref || '',
      'Compendium podcast jobs',
      'circus jobs',
      'job openings'
    ].filter(Boolean)
  };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const job = await getJobById(params.id);
  if (!job) notFound();
  const isFilled = job.status === 'FILLED';
  const salary = job.salary_benefits?.trim() || getDefaultSalaryBenefits(job.job_ref || '');

  return (
    <>
      <JobPageViewedTracker jobId={job.id} jobTitle={job.title} />
      <div className="mb-4">
        <Link href="/jobs" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
            <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
          </svg>
          Back
        </Link>
      </div>
      <article className="overflow-hidden rounded-xl border-2 border-carnival-ink/20 bg-white shadow-card">
        <div className="bg-carnival-ink/5 p-0 sm:p-6">
          <div className="mb-5 space-y-2 px-4 pt-4 sm:px-0 sm:pt-0">
            <div className="flex items-center justify-between gap-3">
              <p className="whitespace-nowrap text-sm font-bold text-carnival-ink">
                <span className="hidden font-black text-carnival-ink sm:inline">Job reference:</span>
                <span className="hidden sm:inline">{' '}</span>
                <span className="font-extrabold text-carnival-red">{job.job_ref}</span>
              </p>
              <StatusPill status={job.status} sorryFilled />
            </div>
          </div>
          <div className="px-4 pb-4 sm:px-0 sm:pb-0">
          <h1 className="text-[1.55rem] font-black leading-[1.08] text-carnival-ink sm:text-[1.95rem] md:text-[2.3rem]">{job.title}</h1>
          <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-carnival-ink/80">{job.description}</p>
          <div className="mt-4 border-t border-carnival-ink/10 pt-3">
            <div className="flex flex-col gap-1 text-sm text-carnival-ink/85 sm:flex-row sm:items-end sm:justify-between">
              <p><strong>Salary:</strong> {salary}</p>
              <p className="sm:text-right"><strong>Reports to:</strong> {job.reports_to}</p>
            </div>
          </div>
          </div>
        </div>
        <div className="space-y-2 border-t border-carnival-ink/10 bg-white px-6 py-5">
          {isFilled ? (
            <p className="mt-4 rounded-md bg-amber-100 p-3 text-base font-semibold">
              This role is currently filled. Please browse other open or rehiring roles.
            </p>
          ) : (
            <div className="mt-1">
              {job.status === 'REHIRING' && `${job.rehiring_reason || ''}`.trim() ? (
                <div className="mx-1 mb-4 rounded-md border border-amber-300 bg-amber-100 px-2 py-1.5 text-sm text-carnival-ink sm:mx-0 sm:px-3 sm:py-2">
                  <p className="text-xs font-black uppercase tracking-wide text-amber-900">Rehiring Reason</p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide leading-relaxed">{job.rehiring_reason}</p>
                </div>
              ) : null}
              <div className="flex justify-center py-4 sm:justify-end">
                <TrackedJobApplyLink href={`/apply/${job.id}`} className="btn-primary inline-flex" jobId={job.id} jobTitle={job.title}>Apply for this role</TrackedJobApplyLink>
              </div>
              <div className="space-y-4">
                <div className="pt-4">
                  <JobContextReadMore jobTitle={job.title} />
                </div>
                <div className="rounded-md border border-carnival-ink/15 bg-carnival-ink/5 p-6 text-sm leading-relaxed text-carnival-ink/80">
                  <p className="text-base font-black uppercase tracking-wide text-black">Terms of application</p>
                  <div className="mt-2 space-y-2 text-[11px] tracking-wide">
                    <p><strong>Existence Is Conditional:</strong> Your continued employment in this role may be paused, resumed, or edited for pacing, at the discretion of Management and/or the Narrator.</p>
                    <p><strong>Predator/Prey Ambiguity:</strong> You acknowledge that the Circus operates a dynamic ecosystem. At any time, you may be reclassified from staff to snack due to budget cuts.</p>
                    <p><strong>Plague &amp; Pestilence:</strong> You accept the risk of contracting dysentery, scurvy, swamp fever, smallpox, or a mysterious ailment simply labelled THE CIRCUS COUGH in a ledger from 1892.</p>
                    <p><strong>Temporal Hazards:</strong> You may encounter paperwork dated tomorrow, yesterday, or the long ago. Submitting forms may cause mild time-looping.</p>
                    <p><strong>Bone Policy:</strong> The Circus cannot confirm the structural integrity of ladders, chairs, unicycles, or your own confidence.</p>
                    <p><strong>Haunting Provision:</strong> Certain tents are haunted. The ghosts are unionised. You agree not to antagonise them unless formally challenged to a duel of paperwork.</p>
                    <p><strong>Lion-Related Arbitration:</strong> Disputes involving lions will be settled by the lion. The lion&apos;s decision is final and may be delivered at speed.</p>
                    <p><strong>Mystery Liquids:</strong> You consent to incidental contact with unidentified liquids. Some are water. Some are not. None will be explained.</p>
                    <p><strong>Emergency Evacuation:</strong> In emergencies, you must follow the illuminated signs unless the signs begin moving, in which case follow the loudest person named Nigel.</p>
                    <p><strong>No Guarantee of Liveliness:</strong> While the Circus endeavours to maintain a generally alive workforce, it cannot guarantee safety, liveliness, intact trousers, or a dignified legacy.</p>
                  </div>
                </div>
                <div className="flex justify-center pt-1 sm:justify-end">
                  <TrackedJobApplyLink href={`/apply/${job.id}`} className="btn-primary inline-flex" jobId={job.id} jobTitle={job.title}>Apply for this role</TrackedJobApplyLink>
                </div>
              </div>
            </div>
          )}
        </div>
      </article>
    </>
  );
}
