import Link from 'next/link';
import { Job } from '@/lib/types';
import { getDefaultSalaryBenefits } from '@/lib/job-salary';
import { StatusPill } from '@/components/status-pill';

export function JobCard({
  job,
  filledBy,
  applicationsClosed = false
}: {
  job: Job;
  filledBy?: string | null;
  applicationsClosed?: boolean;
}) {
  const salary = job.salary_benefits?.trim() || getDefaultSalaryBenefits(job.job_ref || '');

  const panelTintClass =
    job.status === 'FILLED'
      ? 'bg-carnival-ink/10'
      : job.status === 'REHIRING'
        ? 'bg-carnival-gold/20'
        : 'bg-carnival-red/10';

  return (
    <article
      className="flex min-h-[360px] flex-col overflow-hidden rounded-2xl border border-carnival-ink/10 bg-white shadow-[0_10px_26px_rgba(0,0,0,0.10)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_30px_rgba(0,0,0,0.13)]"
      aria-label={`Job ${job.title}`}
    >
      <div className={`${panelTintClass} flex flex-1 flex-col p-4`}>
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-bold text-carnival-ink/70">{job.job_ref}</p>
          <StatusPill status={job.status} />
        </div>

        {filledBy ? (
          <p className="mb-2 truncate text-sm font-semibold text-carnival-ink/80">{filledBy}</p>
        ) : null}

        <h3 className="break-words text-[1.65rem] leading-[1.08] font-bold tracking-tight text-carnival-ink sm:text-[1.8rem]">
          {job.title}
        </h3>

        <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-carnival-ink/80">{job.description}</p>
      </div>

      <div className="flex min-h-[90px] items-center justify-between gap-3 border-t border-carnival-ink/10 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-carnival-ink/65">Salary</p>
          <p className="truncate text-sm font-bold text-carnival-ink">{salary}</p>
          <p className="mt-1 truncate text-xs font-semibold text-carnival-ink/70">
            Reports to: <span className="font-bold text-carnival-ink">{job.reports_to}</span>
          </p>
        </div>
        {job.status !== 'FILLED' ? (
          applicationsClosed ? (
            <span
              aria-disabled="true"
              className="shrink-0 cursor-not-allowed rounded-full bg-carnival-ink/30 px-4 py-1.5 text-xs font-bold text-white"
            >
              Apply
            </span>
          ) : (
            <Link href={`/jobs/${job.id}`} className="shrink-0 rounded-full bg-carnival-red px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700">
              Apply
            </Link>
          )
        ) : null}
      </div>
    </article>
  );
}
