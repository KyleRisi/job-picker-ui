type Status = 'AVAILABLE' | 'FILLED' | 'REHIRING' | string;

export function StatusPill({
  status,
  sorryFilled = false
}: {
  status: Status;
  sorryFilled?: boolean;
}) {
  const normalized = `${status || ''}`.trim().toUpperCase();
  const isSorryFilled = sorryFilled && normalized === 'FILLED';
  const label = isSorryFilled ? 'Sorry, Filled' : normalized || 'UNKNOWN';

  const classes =
    normalized === 'AVAILABLE'
      ? 'bg-green-100 text-green-800 border-green-200'
      : normalized === 'REHIRING'
        ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
        : isSorryFilled
          ? 'bg-blue-100 text-blue-800 border-blue-200'
          : 'bg-red-100 text-red-800 border-red-200';

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${classes}`}>
      {label}
    </span>
  );
}

