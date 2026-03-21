'use client';

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || '';
const MIXPANEL_API_HOST = process.env.NEXT_PUBLIC_MIXPANEL_API_HOST || '';

let initialized = false;
let mixpanelModulePromise: Promise<typeof import('mixpanel-browser')> | null = null;

function loadMixpanelModule() {
  if (!mixpanelModulePromise) {
    mixpanelModulePromise = import('mixpanel-browser');
  }
  return mixpanelModulePromise;
}

export function initMixpanel() {
  if (initialized || typeof window === 'undefined') return;
  if (!MIXPANEL_TOKEN) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[mixpanel] Missing NEXT_PUBLIC_MIXPANEL_TOKEN; analytics is disabled.');
    }
    return;
  }

  void loadMixpanelModule().then(({ default: mixpanel }) => {
    if (initialized) return;
    mixpanel.init(MIXPANEL_TOKEN, {
      debug: process.env.NODE_ENV !== 'production',
      track_pageview: false,
      persistence: 'localStorage',
      autocapture: {
        pageview: false
      },
      record_sessions_percent: 100,
      record_mask_all_text: false,
      record_mask_all_inputs: false,
      record_mask_text_selector:
        'input[type="password"], input[name*="password" i], input[name*="secret" i], input[name*="token" i], input[name*="key" i], textarea[name*="secret" i], textarea[name*="token" i], textarea[name*="key" i], [data-mixpanel-mask="true"]',
      ...(MIXPANEL_API_HOST ? { api_host: MIXPANEL_API_HOST } : {})
    });
    initialized = true;
  });
}

export function trackMixpanel(eventName: string, properties: Record<string, unknown> = {}) {
  if (typeof window === 'undefined') return;
  if (!MIXPANEL_TOKEN) return;
  initMixpanel();
  void loadMixpanelModule().then(({ default: mixpanel }) => {
    mixpanel.track(eventName, properties);
  });
}

export function identifyMixpanel(userId: string, peopleProperties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  if (!MIXPANEL_TOKEN) return;
  if (!userId) return;
  initMixpanel();
  void loadMixpanelModule().then(({ default: mixpanel }) => {
    mixpanel.identify(userId);
    if (peopleProperties && Object.keys(peopleProperties).length) {
      mixpanel.people.set(peopleProperties);
    }
  });
}
