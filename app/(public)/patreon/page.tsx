import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PatreonMembershipGrid } from '@/components/patreon/patreon-membership-grid';
import { PATREON_URL } from '@/lib/patreon-links';
import type { PatreonTier } from '@/lib/patreon-content';

const PATREON_UTM_BASE = `${PATREON_URL}?utm_source=site&utm_medium=cta&utm_campaign=evergreen_membership`;

const membershipTiers: PatreonTier[] = [
  {
    id: 'tier-little-freak',
    internalKey: 'little_freak',
    displayName: 'Little Freak',
    tagline: 'Entry-level supporter access',
    description:
      'Best for listeners who want to support the show and unlock early access plus bonus archive listening when spaces are open.',
    features: [
      'Inducted as a Little Freak',
      'Early access to new episodes',
      'Bonus back catalogue access',
      'Private RSS listening when spaces are open'
    ],
    monthlyPriceUsd: 5,
    annualPriceUsd: 54,
    monthlyPriceLabel: '$5/month',
    annualPriceLabel: '$54/year',
    annualSavingsLabel: 'Save 10% annually',
    supportLevel: 'standard',
    ctaLabel: 'Join Little Freak',
    ctaHref: `${PATREON_UTM_BASE}&utm_content=little_freak`,
    active: true,
    displayOrder: 1,
    soldOut: false
  },
  {
    id: 'tier-certified-freak',
    internalKey: 'certified_freak',
    displayName: 'Certified Freak',
    tagline: 'Most popular member route',
    description:
      'Best value for most supporters: ad-free listening, bonus catalogue episodes, private RSS access, and supporter perks.',
    features: [
      'Ad-free main episodes',
      'Early access to new episodes',
      'Bonus back catalogue access',
      'Private RSS feed access',
      'Personalized shout-out',
      'Keychain eligibility after 3 months'
    ],
    monthlyPriceUsd: 10,
    annualPriceUsd: 108,
    monthlyPriceLabel: '$10/month',
    annualPriceLabel: '$108/year',
    annualSavingsLabel: 'Save 10% annually',
    recommended: true,
    badge: 'Most Popular',
    supportLevel: 'premium',
    ctaLabel: 'Join Certified Freak',
    ctaHref: `${PATREON_UTM_BASE}&utm_content=certified_freak`,
    active: true,
    displayOrder: 2
  },
  {
    id: 'tier-big-tops',
    internalKey: 'big_tops',
    displayName: 'Big Tops',
    tagline: 'Top-tier supporter status',
    description:
      'For listeners who want every core supporter benefit with priority-level backing and immediate keychain eligibility.',
    features: [
      'Everything in Certified Freak',
      'Ad-free main episodes',
      'Early access and private RSS',
      'Bonus catalogue episodes',
      'Keychain eligibility with no waiting'
    ],
    monthlyPriceUsd: 20,
    annualPriceUsd: 216,
    monthlyPriceLabel: '$20/month',
    annualPriceLabel: '$216/year',
    annualSavingsLabel: 'Save 10% annually',
    supportLevel: 'premium',
    ctaLabel: 'Join Big Tops',
    ctaHref: `${PATREON_UTM_BASE}&utm_content=big_tops`,
    active: true,
    displayOrder: 3
  }
];

const faqItems = [
  {
    id: 'private-rss',
    question: 'What is private RSS?',
    answer:
      'Private RSS is a personal podcast feed URL provided by Patreon so you can listen to member episodes in supported podcast apps.'
  },
  {
    id: 'ad-free',
    question: 'Are episodes ad-free on every tier?',
    answer: 'No. Ad-free listening is available on supported tiers, including Certified Freak and Big Tops.'
  },
  {
    id: 'keychain',
    question: 'When do I get the keychain?',
    answer:
      'Certified Freak includes keychain eligibility after 3 paid months. Big Tops includes keychain eligibility with no waiting period.'
  },
  {
    id: 'cancel',
    question: 'Can I cancel anytime?',
    answer: 'Yes. You can manage or cancel your Patreon membership directly through your Patreon account settings.'
  }
];

export const metadata: Metadata = {
  title: 'Patreon | The Compendium Podcast',
  description:
    'Join The Compendium Patreon for early access, ad-free listening, bonus back catalogue episodes, supporter perks and private podcast listening. Compare every membership option.',
  alternates: { canonical: '/patreon' },
  openGraph: {
    title: 'Support The Compendium Podcast on Patreon | Early Access, Bonus Episodes & More',
    description:
      'Join The Compendium Patreon for early access, ad-free listening, bonus back catalogue episodes, supporter perks and private podcast listening. Compare every membership option.',
    url: '/patreon'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Support The Compendium Podcast on Patreon | Early Access, Bonus Episodes & More',
    description:
      'Join The Compendium Patreon for early access, ad-free listening, bonus back catalogue episodes, supporter perks and private podcast listening. Compare every membership option.'
  }
};

export default function PatreonPage() {
  return (
    <section className="full-bleed relative -mt-8 -mb-8 overflow-hidden bg-carnival-ink pb-16 md:pb-20">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <Image
            src="/cover-banner-hero.jpg"
            alt=""
            fill
            priority
            className="object-cover object-top opacity-30"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-carnival-ink/70 via-carnival-ink/85 to-carnival-ink" />
          <div className="absolute -left-20 top-1/4 h-80 w-80 rounded-full bg-carnival-red/20 blur-[120px]" />
          <div className="absolute -right-12 bottom-0 h-72 w-72 rounded-full bg-carnival-gold/20 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-16 md:py-24">
          <p className="text-xs font-black uppercase tracking-[0.08em] text-carnival-gold">The Compendium Patreon</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black leading-tight text-white sm:text-5xl md:text-6xl">
            Support The Compendium Podcast on Patreon
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-relaxed text-white/85 md:text-lg">
            Support the show and unlock more with our official membership desk. Compare tiers side by side,
            see exactly what each level unlocks, and set up private RSS listening in your preferred podcast app.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={`${PATREON_UTM_BASE}&utm_content=hero`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-full bg-carnival-red px-7 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
            >
              Join on Patreon
            </a>
            <a
              href="#membership-options"
              className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-7 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-white/20"
            >
              Compare Membership Options
            </a>
            <Link
              href="/episodes"
              className="inline-flex items-center rounded-full border border-carnival-gold/35 bg-carnival-gold/15 px-7 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-carnival-gold/25"
            >
              Browse Episodes First
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <h2 className="text-3xl font-black text-white md:text-4xl">Why join The Compendium Patreon?</h2>
        <p className="mt-4 max-w-4xl text-sm leading-relaxed text-white/85 md:text-base">
          Patreon is the backstage lane for listeners who want more than the public feed. It helps fund
          research, production, and bonus drops while giving supporters earlier releases and cleaner listening.
        </p>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <PatreonMembershipGrid
          sectionId="membership-options"
          heading="Compare Membership Options"
          tiers={membershipTiers}
          billing={{
            monthlyLabel: 'Pay monthly',
            annualLabel: 'Pay annually (Save 10%)',
            annualSavingsLabel: 'Annual plans save 10% where available.',
            annualEnabled: true,
            disclaimer: 'Annual billing availability depends on Patreon region and tier support.'
          }}
        />
      </div>

      <section className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <div className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-card backdrop-blur-sm">
          <h2 className="text-3xl font-black text-white md:text-4xl">Frequently asked questions</h2>
          <div className="mt-4 space-y-3">
            {faqItems.map((faq) => (
              <details key={faq.id} className="rounded-2xl border border-white/15 bg-white/10 p-5 shadow-card">
                <summary className="cursor-pointer list-none text-base font-bold text-white">{faq.question}</summary>
                <p className="mt-3 text-sm leading-relaxed text-white/80 md:text-base">{faq.answer}</p>
              </details>
            ))}
          </div>

          <div className="mt-6 text-center">
            <a
              href={`${PATREON_UTM_BASE}&utm_content=faq`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-w-[20rem] items-center justify-center rounded-full bg-carnival-red px-10 py-4 text-base font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
            >
              Join on Patreon
            </a>
          </div>
        </div>
      </section>
    </section>
  );
}
