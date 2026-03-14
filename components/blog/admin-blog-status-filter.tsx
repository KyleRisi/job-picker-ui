'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type BlogStatusFilter = 'all' | 'draft' | 'published' | 'scheduled' | 'archived';

const BLOG_STATUS_FILTERS: Array<{ value: BlogStatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'archived', label: 'Archived' }
];

export function AdminBlogStatusFilter({
  value
}: {
  value: BlogStatusFilter;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className="label w-full max-w-[220px] text-left">
      Status
      <select
        className="input mt-1"
        value={value}
        disabled={isPending}
        onChange={(event) => {
          startTransition(() => {
            const nextValue = event.target.value as BlogStatusFilter;
            const params = new URLSearchParams(searchParams.toString());
            params.set('status', nextValue);
            params.delete('page');
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
          });
        }}
      >
        {BLOG_STATUS_FILTERS.map((filter) => (
          <option key={filter.value} value={filter.value}>{filter.label}</option>
        ))}
      </select>
    </label>
  );
}
