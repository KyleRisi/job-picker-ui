'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type Option = {
  value: string;
  label: string;
};

export function AdminQuerySelectFilter({
  label,
  paramKey,
  value,
  options
}: {
  label: string;
  paramKey: string;
  value: string;
  options: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function onChange(nextValue: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (nextValue === 'all') {
      params.delete(paramKey);
    } else {
      params.set(paramKey, nextValue);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <label className="label flex flex-col items-start">
      {label}
      <select
        className="input mt-1 !block !w-auto min-w-[12rem]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
