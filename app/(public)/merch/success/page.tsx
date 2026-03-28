import type { Metadata } from 'next';
import Link from 'next/link';
import { MerchPurchaseTracker } from '@/components/merch-purchase-tracker';
import { buildCanonicalAndSocialMetadata } from '@/lib/seo-metadata';

export const metadata: Metadata = {
  title: 'Order Confirmed | Merch',
  description: 'Your Compendium merch order has been placed successfully.',
  ...buildCanonicalAndSocialMetadata({
    title: 'Order Confirmed | Merch',
    description: 'Your Compendium merch order has been placed successfully.',
    twitterTitle: 'Order Confirmed | Merch',
    twitterDescription: 'Your Compendium merch order has been placed successfully.',
    canonicalCandidate: '/merch/success',
    fallbackPath: '/merch/success',
    openGraphType: 'website',
    imageUrl: '/The Compendium Main.jpg',
    imageAlt: 'The Compendium Podcast merch order confirmation'
  })
};

export default function MerchSuccessPage({
  searchParams
}: {
  searchParams?: { session_id?: string };
}) {
  const sessionId = `${searchParams?.session_id || ''}`.trim();

  return (
    <section className="full-bleed relative -mt-8 -mb-8 overflow-hidden bg-carnival-ink py-16 md:py-24">
      <MerchPurchaseTracker sessionId={sessionId} />
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute left-1/2 top-0 h-[440px] w-[700px] -translate-x-1/2 rounded-full bg-carnival-gold/10 blur-[140px]" />
      </div>

      <div className="relative mx-auto max-w-2xl px-4">
        <article className="rounded-2xl border border-white/15 bg-white/10 p-7 text-center shadow-card sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-carnival-gold">Order Confirmed</p>
          <h1 className="mt-2 text-4xl font-black text-white">Thank You</h1>
          <p className="mt-3 text-base leading-relaxed text-white/80">
            Your order has been received. Stripe will email your receipt and payment confirmation.
          </p>

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/merch"
              className="inline-flex items-center justify-center rounded-full bg-carnival-red px-7 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
            >
              Back to Merch
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-7 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-white/20"
            >
              Go Home
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
