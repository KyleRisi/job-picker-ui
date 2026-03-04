import { JobsTabs } from '@/components/jobs-tabs';
import { JobsApplicationSuccessModal } from '@/components/jobs-application-success-modal';
import { unstable_noStore as noStore } from 'next/cache';
import type { Metadata } from 'next';
import { getJobsForPublic, getSettings } from '@/lib/data';

export const metadata: Metadata = {
  title: 'Circus Openings',
  description:
    'Browse open and rehiring roles at Compendium Circus HR and apply to join The Compendium universe.',
  alternates: {
    canonical: '/jobs'
  },
  openGraph: {
    title: 'Circus Openings | Compendium Circus HR',
    description:
      'Browse open and rehiring roles at Compendium Circus HR and apply to join The Compendium universe.',
    url: '/jobs'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Circus Openings | Compendium Circus HR',
    description:
      'Browse open and rehiring roles at Compendium Circus HR and apply to join The Compendium universe.'
  }
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function JobsPage() {
  noStore();
  const [jobs, settings] = await Promise.all([getJobsForPublic(), getSettings()]);

  return (
    <section>
      <JobsApplicationSuccessModal />
      <h1 className="mb-2 text-4xl font-black">Circus Openings</h1>
      <p className="mb-6">Browse available and filled positions.</p>
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
  );
}
