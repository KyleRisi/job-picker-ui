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

    const episodePages = root.querySelectorAll<HTMLElement>('[data-author-episode-page]');
    episodePages.forEach((panel) => {
      const panelPage = Number.parseInt(panel.dataset.authorEpisodePage || '1', 10);
      panel.hidden = tab !== 'episodes' || panelPage !== page;
    });

    const episodeViews = root.querySelectorAll<HTMLElement>('[data-author-episode-view]');
    episodeViews.forEach((panel) => {
      const panelPage = Number.parseInt(panel.dataset.authorEpisodePage || '1', 10);
      panel.hidden = tab !== 'episodes' || panelPage !== page || panel.dataset.authorEpisodeView !== view;
    });

    const viewLinks = root.querySelectorAll<HTMLAnchorElement>('[data-author-view-link="true"]');
    viewLinks.forEach((link) => {
      const linkPage = Number.parseInt(link.dataset.authorEpisodePage || '1', 10);
      const isActive = tab === 'episodes' && linkPage === page && link.dataset.authorViewValue === view;
      link.setAttribute('aria-checked', isActive ? 'true' : 'false');
      link.classList.toggle('bg-carnival-ink', isActive);
      link.classList.toggle('text-white', isActive);
      link.classList.toggle('text-carnival-ink/50', !isActive);
      link.classList.toggle('hover:text-carnival-ink', !isActive);
    });
  }, [searchParams, totalEpisodePages]);

  return null;
}
