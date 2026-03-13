'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { JobCard } from './job-card';
import { Job } from '@/lib/types';

type JobWithHolder = Job & { filledBy?: string | null; filledByFull?: string | null; filledAt?: string | null };

export function JobsTabs({
  jobs,
  showFilledNames,
  applicationsClosed = false
}: {
  jobs: JobWithHolder[];
  showFilledNames: boolean;
  applicationsClosed?: boolean;
}) {
  const INITIAL_AVAILABLE_COUNT = 12;
  const REVEAL_STEP = 12;
  const [tab, setTab] = useState<'available' | 'filled'>('available');
  const [visibleAvailableCount, setVisibleAvailableCount] = useState(INITIAL_AVAILABLE_COUNT);
  const normalizeStatus = (status: string) => status.trim().toUpperCase();

  const available = useMemo(
    () => jobs.filter((job) => normalizeStatus(job.status) !== 'FILLED'),
    [jobs]
  );
  const filled = useMemo(
    () =>
      jobs
        .filter((job) => normalizeStatus(job.status) === 'FILLED')
        .sort((a, b) => {
          const aTime = a.filledAt ? new Date(a.filledAt).getTime() : 0;
          const bTime = b.filledAt ? new Date(b.filledAt).getTime() : 0;
          return bTime - aTime;
        }),
    [jobs]
  );

  const visibleAvailable = useMemo(
    () => available.slice(0, visibleAvailableCount),
    [available, visibleAvailableCount]
  );
  const remainingAvailable = Math.max(available.length - visibleAvailable.length, 0);
  const canLoadMoreAvailable = tab === 'available' && remainingAvailable > 0;

  return (
    <section>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div role="tablist" aria-label="Job status tabs" className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'available'}
            aria-controls="panel-available"
            id="tab-available"
            className={`btn w-full justify-center sm:w-auto ${tab === 'available' ? 'bg-carnival-red text-white' : 'bg-white border border-carnival-ink/30'}`}
            onClick={() => setTab('available')}
          >
            <span className="hidden sm:inline">Available Positions</span>
            <span className="sm:hidden">Available</span>
            <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/25 px-2 text-xs font-bold leading-none">
              {available.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'filled'}
            aria-controls="panel-filled"
            id="tab-filled"
            className={`btn w-full justify-center sm:w-auto ${tab === 'filled' ? 'bg-carnival-red text-white' : 'bg-white border border-carnival-ink/30'}`}
            onClick={() => setTab('filled')}
          >
            <span className="hidden sm:inline">Filled Positions</span>
            <span className="sm:hidden">Filled</span>
            <span className="ml-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-white/25 px-2 text-xs font-bold leading-none">
              {filled.length}
            </span>
          </button>
        </div>
        <Link href="/my-job" className="btn-secondary w-full text-center sm:ml-auto sm:w-auto">
          I already have a job
        </Link>
      </div>

      <div
        role="tabpanel"
        id={tab === 'available' ? 'panel-available' : 'panel-filled'}
        aria-labelledby={tab === 'available' ? 'tab-available' : 'tab-filled'}
        className="grid gap-4 px-1 sm:px-0 md:grid-cols-2 xl:grid-cols-3"
      >
        {tab === 'available'
            ? visibleAvailable.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                filledBy={null}
                applicationsClosed={applicationsClosed}
                clickableToDetails
                showApplyButton={false}
              />
            ))
          : filled.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                filledBy={showFilledNames ? job.filledBy || 'Anonymous Performer' : job.filledByFull || job.filledBy || 'Anonymous Performer'}
                applicationsClosed={applicationsClosed}
              />
            ))}
      </div>
        {canLoadMoreAvailable ? (
          <div className="pt-6 text-center">
            <button
              type="button"
              className="btn-secondary"
              onClick={() =>
                setVisibleAvailableCount((current) => Math.min(current + REVEAL_STEP, available.length))
              }
            >
              Load More Roles ({remainingAvailable} remaining)
            </button>
          </div>
        ) : null}
    </section>
  );
}
