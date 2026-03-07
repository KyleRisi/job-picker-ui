'use client';

type LiveSearchInputProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel?: string;
  className?: string;
};

export function LiveSearchInput({
  id,
  value,
  onChange,
  placeholder,
  ariaLabel,
  className = ''
}: LiveSearchInputProps) {
  return (
    <div className={`relative ${className}`.trim()}>
      <input
        id={id}
        className="w-full rounded-xl border-2 border-carnival-ink/20 bg-white py-3 pl-4 pr-4 text-base font-semibold text-carnival-ink transition placeholder:text-carnival-ink/45 focus:border-carnival-gold focus:outline-none focus:ring-4 focus:ring-carnival-gold/45"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        aria-label={ariaLabel || placeholder}
      />
    </div>
  );
}
