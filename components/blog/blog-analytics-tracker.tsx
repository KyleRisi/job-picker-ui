'use client';

import { useEffect } from 'react';

type Props = {
  postId?: string | null;
  episodeId?: string | null;
  searchQuery?: string;
};

async function track(body: Record<string, unknown>) {
  try {
    await fetch('/api/blog/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true
    });
  } catch {
    // Ignore analytics transport failures.
  }
}

export function BlogAnalyticsTracker({ postId = null, episodeId = null, searchQuery = '' }: Props) {
  useEffect(() => {
    void track({
      eventType: 'pageview',
      postId,
      episodeId,
      path: window.location.pathname + window.location.search,
      referrer: document.referrer,
      searchQuery,
      metadata: {
        title: document.title
      }
    });
  }, [episodeId, postId, searchQuery]);

  useEffect(() => {
    const breakpoints = [25, 50, 75, 100];
    const fired = new Set<number>();

    function onScroll() {
      const scrollTop = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      const percent = Math.round((scrollTop / total) * 100);
      breakpoints.forEach((point) => {
        if (percent >= point && !fired.has(point)) {
          fired.add(point);
          void track({
            eventType: 'scroll_depth',
            postId,
            episodeId,
            path: window.location.pathname + window.location.search,
            referrer: document.referrer,
            metadata: { scrollPercent: point }
          });
        }
      });
    }

    function onClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a');
      if (!anchor) return;
      const href = anchor.getAttribute('href') || '';
      if (!href) return;
      if (/spotify/i.test(href) || /apple\.com\/.*podcast/i.test(href)) {
        void track({
          eventType: 'platform_click',
          postId,
          episodeId,
          path: window.location.pathname + window.location.search,
          referrer: document.referrer,
          metadata: { href }
        });
      }
      if (/patreon/i.test(href)) {
        void track({
          eventType: 'patreon_click',
          postId,
          episodeId,
          path: window.location.pathname + window.location.search,
          referrer: document.referrer,
          metadata: { href }
        });
      }
      if (anchor.dataset.blogCta === '1') {
        void track({
          eventType: 'cta_click',
          postId,
          episodeId,
          path: window.location.pathname + window.location.search,
          referrer: document.referrer,
          metadata: {
            href,
            label: anchor.textContent || ''
          }
        });
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick);
    };
  }, [episodeId, postId]);

  return null;
}
