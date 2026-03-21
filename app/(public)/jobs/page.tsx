import { JobsTabs } from '@/components/jobs-tabs';
import { JobsApplicationSuccessModal } from '@/components/jobs-application-success-modal';
import { unstable_noStore as noStore } from 'next/cache';
import type { Metadata } from 'next';
import Link from 'next/link';
import { getJobsForPublic, getSettings } from '@/lib/data';
import { JobsListingsViewedTracker } from '@/components/jobs-analytics-trackers';

export const metadata: Metadata = {
  title: {
    absolute: 'Jobs | The Compendium Podcast'
  },
  description:
    'Browse open and rehiring roles at The Compendium Podcast and apply to join The Compendium universe.',
  alternates: {
    canonical: '/jobs'
  },
  openGraph: {
    title: 'Circus Openings | The Compendium Podcast',
    description:
      'Browse open and rehiring roles at The Compendium Podcast and apply to join The Compendium universe.',
    url: '/jobs'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Circus Openings | The Compendium Podcast',
    description:
      'Browse open and rehiring roles at The Compendium Podcast and apply to join The Compendium universe.'
  }
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function JobsPage() {
  noStore();
  const [jobs, settings] = await Promise.all([getJobsForPublic(), getSettings()]);

  return (
    <>
      <JobsListingsViewedTracker listingCount={jobs.length} />
      <JobsApplicationSuccessModal />
      <section className="full-bleed relative -mt-8 overflow-hidden bg-carnival-ink pb-16 pt-16 md:pb-20 md:pt-20">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-carnival-red/30 blur-[120px]" />
          <div className="absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-carnival-gold/20 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-carnival-gold">The Compendium Podcast</p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-black tracking-tight text-white sm:text-5xl">Circus Openings</h1>
              <span className="rounded-full border border-white/25 bg-carnival-red px-3 py-0.5 text-sm font-black text-white">
                {jobs.length}
              </span>
            </div>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/85 sm:text-lg">
              Pick a job and apply to join the team, then submit a wacky performance review and get featured on a future episode.
            </p>
            <div className="mt-6">
              <Link
                href="/meet-the-team"
                className="inline-flex items-center rounded-full border border-white/25 bg-white/10 px-5 py-2 text-sm font-black text-white transition hover:bg-white/20"
              >
                Meet the Team
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-6 md:pt-8">
        {settings.disable_new_signups ? (
          <p className="mb-6 rounded-md border border-carnival-red/25 bg-carnival-red/10 px-4 py-3 text-center font-semibold text-carnival-ink">
            Due to a bear mauling, we are not accepting any new applications.
          </p>
        ) : null}
        <JobsTabs
          jobs={jobs}
          showFilledNames={settings.show_filled_first_names}
          applicationsClosed={settings.disable_new_signups}
        />
      </section>
    </>
  );
}
