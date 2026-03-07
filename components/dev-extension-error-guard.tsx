'use client';

import { useEffect } from 'react';

function textFromReason(reason: unknown): string {
  if (!reason) return '';
  if (typeof reason === 'string') return reason;
  if (reason instanceof Error) return `${reason.message}\n${reason.stack || ''}`;
  if (typeof reason === 'object') return JSON.stringify(reason);
  return `${reason}`;
}

function looksLikeInjectedExtensionError(input: string): boolean {
  const value = input.toLowerCase();
  return (
    value.includes('metamask') ||
    value.includes('inpage.js') ||
    value.includes('chrome-extension://') ||
    value.includes('runtime.lasterror')
  );
}

export function DevExtensionErrorGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const details = textFromReason(event.reason);
      if (!looksLikeInjectedExtensionError(details)) return;
      event.preventDefault();
    }

    function onError(event: ErrorEvent) {
      const details = `${event.message || ''}\n${event.filename || ''}\n${event.error ? textFromReason(event.error) : ''}`;
      if (!looksLikeInjectedExtensionError(details)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    window.addEventListener('unhandledrejection', onUnhandledRejection);
    window.addEventListener('error', onError, true);
    return () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      window.removeEventListener('error', onError, true);
    };
  }, []);

  return null;
}
