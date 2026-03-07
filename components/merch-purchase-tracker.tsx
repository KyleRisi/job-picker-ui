'use client';

import { useEffect } from 'react';
import { trackMixpanel } from '@/lib/mixpanel-browser';

export function MerchPurchaseTracker({ sessionId }: { sessionId?: string }) {
  useEffect(() => {
    const transactionId = `${sessionId || ''}`.trim();
    const dedupeKey = `mixpanel:purchase:${transactionId || 'unknown'}`;
    const alreadyTracked = window.sessionStorage.getItem(dedupeKey) === '1';
    if (alreadyTracked) return;

    trackMixpanel('Purchase', {
      user_id: null,
      transaction_id: transactionId,
      revenue: null,
      currency: 'USD'
    });

    trackMixpanel('Conversion', {
      'Conversion Type': 'purchase',
      'Conversion Value': null
    });

    window.sessionStorage.setItem(dedupeKey, '1');
  }, [sessionId]);

  return null;
}
