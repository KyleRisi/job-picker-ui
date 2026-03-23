import Link from 'next/link';

export function WorkspaceFreakyRegisterActions() {
  return (
    <div className="flex items-center gap-2">
      <Link
        href="/freaky-register"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-8 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Open board
      </Link>
    </div>
  );
}
