'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

function parsePage(value: string | null, maxPages: number) {
  const parsed = Number.parseInt(`${value || '1'}`, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.min(parsed, Math.max(1, maxPages));
}

export function AuthorHubClient({ totalEpisodePages }: { totalEpisodePages: number }) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-author-hub-root="true"]');
    if (!root) return;

    const tab = searchParams.get('tab') === 'blogs' ? 'blogs' : 'episodes';
    const view = searchParams.get('view') === 'grid' ? 'grid' : 'compact';
    const page = parsePage(searchParams.get('page'), totalEpisodePages);
    const isCanonicalEpisodeState = tab === 'episodes' && view === 'compact' && page === 1;

    const tabPanels = root.querySelectorAll<HTMLElement>('[data-author-tab-panel]');
    tabPanels.forEach((panel) => {
      panel.hidden = panel.dataset.authorTabPanel !== tab;
    });

    const tabLinks = root.querySelectorAll<HTMLAnchorElement>('[data-author-tab-link="true"]');
    tabLinks.forEach((link) => {
      const isActive = link.dataset.authorTabValue === tab;
      link.classList.toggle('border-carnival-red', isActive);
      link.classList.toggle('bg-carnival-red', isActive);
      link.classList.toggle('text-white', isActive);
      link.classList.toggle('border-white/25', !isActive);
      link.classList.toggle('bg-transparent', !isActive);
      link.classList.toggle('text-white/85', !isActive);
      link.classList.toggle('hover:bg-white/10', !isActive);
    });

    const canonicalEpisodes = root.querySelector<HTMLElement>('[data-author-episodes-canonical="true"]');
    if (canonicalEpisodes) {
      canonicalEpisodes.hidden = !isCanonicalEpisodeState;
    }

    const queryRegion = root.querySelector<HTMLElement>('[data-author-episodes-query-region="true"]');
    if (queryRegion) {
      queryRegion.hidden = tab !== 'episodes' || isCanonicalEpisodeState;
    }
  }, [searchParams, totalEpisodePages]);

  return null;
}
