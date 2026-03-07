import type { ReactNode } from 'react';

export function FeaturedEpisodeShowcase({
  heading = 'Listen to the linked episode',
  surface = 'none',
  className = '',
  headingClassName = 'text-2xl font-black text-carnival-ink',
  children
}: {
  heading?: string;
  surface?: 'none' | 'lightPanel';
  className?: string;
  headingClassName?: string;
  children: ReactNode;
}) {
  const sectionClassName = ['space-y-3', className].filter(Boolean).join(' ');

  if (surface === 'lightPanel') {
    return (
      <section aria-label={`${heading} showcase`} className={`${sectionClassName} rounded-3xl bg-carnival-gold/90 p-5 md:p-6`}>
        <h2 className={headingClassName}>{heading}</h2>
        {children}
      </section>
    );
  }

  return (
    <section aria-label={`${heading} showcase`} className={sectionClassName}>
      <h2 className={headingClassName}>{heading}</h2>
      {children}
    </section>
  );
}
