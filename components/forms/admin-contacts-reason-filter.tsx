'use client';

import { AdminQuerySelectFilter } from '@/components/forms/admin-query-select-filter';

type ContactReasonFilter = 'all' | 'general' | 'press' | 'guest' | 'sponsorship' | 'other';

export function AdminContactsReasonFilter({ value }: { value: ContactReasonFilter }) {
  return (
    <AdminQuerySelectFilter
      label="Type"
      paramKey="reason"
      value={value}
      options={[
        { value: 'all', label: 'All enquiries' },
        { value: 'press', label: 'Press / media' },
        { value: 'general', label: 'General enquiry' },
        { value: 'guest', label: 'Guest request' },
        { value: 'sponsorship', label: 'Sponsorship' },
        { value: 'other', label: 'Other' }
      ]}
    />
  );
}
