'use client';

import mixpanel from 'mixpanel-browser';

const MIXPANEL_TOKEN = 'c2d2aeb94e8712b97cab8d12817dc3aa';

let initialized = false;

export function initMixpanel() {
  if (initialized || typeof window === 'undefined') return;

  mixpanel.init(MIXPANEL_TOKEN, {
    debug: process.env.NODE_ENV !== 'production',
    track_pageview: true,
    persistence: 'localStorage',
    autocapture: true,
    record_sessions_percent: 100
  });
  initialized = true;
}

export function trackMixpanel(eventName: string, properties: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  initMixpanel();
  mixpanel.track(eventName, properties);
}

export function identifyMixpanel(userId: string, peopleProperties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  if (!userId) return;
  initMixpanel();
  mixpanel.identify(userId);
  if (peopleProperties && Object.keys(peopleProperties).length) {
    mixpanel.people.set(peopleProperties);
  }
}
