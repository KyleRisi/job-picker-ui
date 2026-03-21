'use client';

import Link from 'next/link';
import { trackMixpanel } from '@/lib/mixpanel-browser';

type ListingLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
  jobId: string;
  jobTitle: string;
};

type ApplyLinkProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
  jobId: string;
  jobTitle: string;
};

export function TrackedJobListingLink({ href, className, children, jobId, jobTitle }: ListingLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        trackMixpanel('Job Listing Clicked', {
          job_id: jobId,
          job_title: jobTitle,
          source_page_type: 'jobs_page',
          source_page_path: `${window.location.pathname}${window.location.search || ''}`
        });
      }}
    >
      {children}
    </Link>
  );
}

export function TrackedJobApplyLink({ href, className, children, jobId, jobTitle }: ApplyLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => {
        trackMixpanel('Job Apply Clicked', {
          job_id: jobId,
          job_title: jobTitle,
          source_page_type: 'job_page',
          source_page_path: `${window.location.pathname}${window.location.search || ''}`
        });
      }}
    >
      {children}
    </Link>
  );
}
