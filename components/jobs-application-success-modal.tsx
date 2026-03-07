'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function JobsApplicationSuccessModal() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname() || '/jobs';

  if (params.get('applied') !== '1') return null;

  const jobTitle = params.get('jobTitle') || 'Your new role';
  const jobRef = params.get('jobRef') || 'JOB-0000';
  const email = params.get('email') || '';
  const assignmentRef = params.get('assignmentRef') || '';
  const editHref = assignmentRef && email ? `/my-job/file?email=${encodeURIComponent(email)}&ref=${encodeURIComponent(assignmentRef)}` : '/my-job';

  function closeModal() {
    const next = new URLSearchParams(params.toString());
    ['applied', 'jobTitle', 'jobRef', 'email', 'jobId', 'assignmentRef'].forEach((key) => next.delete(key));
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-carnival-ink/15 bg-white p-5 text-center shadow-card">
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            className="rounded-md border border-carnival-ink/20 bg-white px-3 py-1.5 text-sm font-semibold text-black hover:bg-carnival-cream"
            onClick={closeModal}
            aria-label="Close"
          >
            x
          </button>
        </div>

        <div className="mx-auto mb-4 w-full max-w-[220px] bg-white p-2">
          <Image
            src="/hired.svg"
            alt="Hired stamp"
            width={220}
            height={220}
            className="block h-auto w-full"
          />
        </div>

        <h2 className="mt-2 text-2xl font-black leading-tight text-carnival-ink">
          Congratulations. You&apos;re hired.
        </h2>

        <div className="mt-4 rounded-lg border border-carnival-ink/15 bg-carnival-ink/5 p-4">
          <p className="text-lg font-black leading-tight text-carnival-ink">{jobTitle}</p>
          <p className="mt-2 text-sm font-semibold text-carnival-ink/80">
            Job reference: <span className="font-black text-carnival-red">{jobRef}</span>
          </p>
        </div>

        <p className="mt-4 text-xs font-medium text-carnival-ink/80">
          Your documents have been sent to you via email.
        </p>

        <div className="mt-4 space-y-2">
          <Link href={editHref} className="btn-primary flex w-full justify-center">
            Edit application
          </Link>
        </div>

        {email ? (
          <p className="mt-4 text-sm text-carnival-ink/75">
            Find it later via My Job using <span className="font-bold text-carnival-ink">{jobRef}</span> +{' '}
            <span className="font-bold text-carnival-ink">{email}</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}
