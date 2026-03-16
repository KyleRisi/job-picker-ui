export type ViewMode = 'grid' | 'compact';

export const VIEW_MODE_STORAGE_KEY = 'compendium:episodes:view-mode';

export function ViewModeToggle({
  mode,
  onChange
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="flex h-[50px] items-center gap-1 rounded-xl border-2 border-carnival-ink/20 bg-white p-1" role="radiogroup" aria-label="View mode">
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'grid'}
        aria-label="Grid view"
        className={`flex h-[42px] w-[42px] items-center justify-center rounded-lg transition ${mode === 'grid' ? 'bg-carnival-ink text-white' : 'text-carnival-ink/50 hover:text-carnival-ink'}`}
        onClick={() => onChange('grid')}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
        </svg>
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'compact'}
        aria-label="Compact list view"
        className={`flex h-[42px] w-[42px] items-center justify-center rounded-lg transition ${mode === 'compact' ? 'bg-carnival-ink text-white' : 'text-carnival-ink/50 hover:text-carnival-ink'}`}
        onClick={() => onChange('compact')}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>
    </div>
  );
}
