'use client';

export function NewTaxonomyButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('workspace-taxonomies:new'))}
      className="inline-flex h-9 items-center gap-1.5 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
    >
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-current">
        <path d="M8 1a1 1 0 0 1 1 1v5h5a1 1 0 1 1 0 2H9v5a1 1 0 1 1-2 0V9H2a1 1 0 0 1 0-2h5V2a1 1 0 0 1 1-1z" />
      </svg>
      New
    </button>
  );
}
