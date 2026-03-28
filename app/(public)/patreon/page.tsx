import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PatreonMembershipGrid } from '@/components/patreon/patreon-membership-grid';
import { TrackedPatreonCtaLink } from '@/components/tracked-patreon-cta-link';
import { PATREON_URL } from '@/lib/patreon-links';
import type { PatreonTier } from '@/lib/patreon-content';
import { buildCanonicalAndSocialMetadata } from '@/lib/seo-metadata';

const PATREON_UTM_BASE = `${PATREON_URL}?utm_source=site&utm_medium=cta&utm_campaign=evergreen_membership`;

const membershipTiers: PatreonTier[] = [
  {
    id: 'tier-little-freak',
    internalKey: 'little_freak',
    displayName: 'Little Freak',
    tagline: 'Entry-level supporter access',
    description:
      'Best for listeners who want to support the show, collect their official supporter stamp, and unlock early access plus bonus archive listening when spaces are open.',
    features: [
      'Inducted as a Little Freak',
      'Early access to new episodes',
      'Bonus back catalogue episodes',
      'Instant access to your private RSS feed'
    ],
    monthlyPriceUsd: 5,
    annualPriceUsd: 54,
    monthlyPriceLabel: '$5/month',
    annualPriceLabel: '$54/year',
    annualSavingsLabel: 'Save 10% annually',
    supportLevel: 'entry',
    ctaLabel: 'Join Little Freaks',
    ctaHref: `${PATREON_UTM_BASE}&utm_content=tier_little_freak`,
    active: true,
    displayOrder: 1,
    soldOut: true
  },
  {
    id: 'tier-certified-freak',
    internalKey: 'certified_freak',
    displayName: 'Certified Freak',
    tagline: 'Best-value supporter tier',
    description:
      'Best for regular listeners who want the full core member experience, including ad-free listening, bonus archive access, and a neatly processed premium upgrade.',
    features: [
      'Inducted as a Certified Freak',
      'Ad-free main episodes',
      'Early access to new episodes',
      'Bonus back catalogue episodes',
      'Instant access to your private RSS feed',
      'The Compendium keychain after 3 months',
      'Personalized shout-out'
    ],
    monthlyPriceUsd: 8,
    annualPriceUsd: 86.4,
    monthlyPriceLabel: '$8/month',
    annualPriceLabel: '$86.40/year',
    annualSavingsLabel: 'Save 10% annually',
    recommended: true,
    badge: 'Most Popular',
    supportLevel: 'core',
    ctaLabel: 'Join Certified Freak',
    ctaHref: `${PATREON_UTM_BASE}&utm_content=tier_certified_freak`,
    active: true,
    displayOrder: 2
  },
  {
    id: 'tier-big-tops',
    internalKey: 'big_tops',
    displayName: 'Big Top',
    tagline: 'Highest-access premium tier',
    description:
      'Best for superfans who want top-level access, full ad-free support, and immediate premium perks with minimal waiting-room energy.',
    features: [
      'Inducted as a Big Top member',
      'Ad-free main episodes',
      'Early access to new episodes',
      'Bonus back catalogue episodes',
      'All latest Things episodes',
      'Instant access to your private RSS feed',
      'The Compendium keychain with no waiting',
      'A personalized shout-out'
    ],
    monthlyPriceUsd: 15,
    annualPriceUsd: 162,
    monthlyPriceLabel: '$15/month',
    annualPriceLabel: '$162/year',
    annualSavingsLabel: 'Save 10% annually',
    badge: 'Premium Access',
    supportLevel: 'premium',
    ctaLabel: 'Join Big Top',
    ctaHref: `${PATREON_UTM_BASE}&utm_content=tier_big_tops`,
    active: true,
    displayOrder: 3
  }
];

const benefitCards = [
  {
    id: 'benefit-early-access',
    emoji: '🎧',
    title: 'Early access to new episodes',
    body: 'Members get episodes earlier, so you can listen before the rest of the internet catches up.'
  },
  {
    id: 'benefit-ad-free',
    emoji: '🔕',
    title: 'Ad-free listening on supported tiers',
    body: 'Skip ad interruptions in the main feed on tiers that include ad-free playback.'
  },
  {
    id: 'benefit-bonus-back-catalogue',
    emoji: '🗂️',
    title: 'Bonus back catalogue episodes',
    body: 'Go beyond the public archive with extra episodes and additional context drops.'
  },
  {
    id: 'benefit-keychain',
    emoji: '🗝️',
    title: 'Keychain perks on eligible tiers',
    body: 'Physical supporter perks kick in on specific membership levels and timelines.'
  }
];

const listenSteps = [
  {
    id: 'listen-step-1',
    title: '1. Join on Patreon',
    body: 'Choose your membership tier on Patreon and complete checkout. Once payment is confirmed, your supporter status is officially activated.'
  },
  {
    id: 'listen-step-2',
    title: '2. Choose your tier benefits',
    body: 'Confirm the tier you selected and review the included perks. If your preferred tier is sold out, join an available one now and upgrade later if needed.'
  },
  {
    id: 'listen-step-3',
    title: '3. Open your private RSS instructions',
    body: 'Inside Patreon, open your membership benefits and copy your private RSS link. Patreon also shows app-specific setup instructions for supported players.'
  },
  {
    id: 'listen-step-4',
    title: '4. Listen in your preferred podcast app',
    body: 'Paste your private RSS feed into a supported app and start listening. New member episodes appear there as they are released, with no extra hoop-jumping required.'
  }
];

const faqItems = [
  {
    id: 'little-freak-benefits',
    question: 'What do I get with Little Freak?',
    answer:
      'Little Freak includes early access, bonus back catalogue access, and private RSS listening when spaces are open.'
  },
  {
    id: 'little-freak-sold-out',
    question: 'Why is Little Freak sold out?',
    answer:
      'Little Freak is capacity-limited. When slots are full, new joins pause until availability reopens and fresh places are released.'
  },
  {
    id: 'certified-freak-benefits',
    question: 'What do I get with Certified Freak?',
    answer:
      'Certified Freak includes ad-free main episodes, early access, bonus catalogue episodes, private RSS access, keychain eligibility after 3 months, and a personalized shout-out.'
  },
  {
    id: 'big-top-benefits',
    question: 'What do I get with Big Tops?',
    answer:
      'Big Top membership includes every core supporter benefit, including ad-free listening, early access, private RSS, bonus episodes, and immediate keychain eligibility with no waiting.'
  },
  {
    id: 'best-value-tier',
    question: 'Which tier is the best value?',
    answer:
      'Certified Freak is the best value for most members because it unlocks the core ad-free and bonus stack at a balanced monthly price.'
  },
  {
    id: 'most-popular-meaning',
    question: 'What does Most Popular mean here?',
    answer:
      'Most Popular marks the tier currently chosen by the largest share of active supporters. Think of it as the most commonly approved route through the system.'
  },
  {
    id: 'private-rss-meaning',
    question: 'What is private RSS?',
    answer:
      'Private RSS is a personal podcast feed URL provided by Patreon for your account so you can listen in compatible podcast apps.'
  },
  {
    id: 'how-to-listen-after-joining',
    question: 'How do I listen after joining?',
    answer:
      'After checkout, open your Patreon benefits, copy your private RSS feed, and add it to a supported podcast app using Patreon instructions.'
  },
  {
    id: 'ad-free-all-tiers',
    question: 'Are episodes ad-free on every tier?',
    answer: 'No. Ad-free listening is available on supported tiers, including Certified Freak and Big Top.'
  },
  {
    id: 'keychain-timing',
    question: 'When do I get the keychain?',
    answer:
      'Certified Freak includes keychain eligibility after 3 paid months. Big Top includes keychain eligibility with no waiting period.'
  },
  {
    id: 'after-three-months-meaning',
    question: 'What does After 3 Months mean?',
    answer:
      'It means you become eligible for that perk once three full paid months at that tier have completed.'
  },
  {
    id: 'no-waiting-meaning',
    question: 'What does No Waiting mean?',
    answer: 'No Waiting means the perk is available immediately once your membership is active at that tier.'
  },
  {
    id: 'upgrade-later-faq',
    question: 'Can I upgrade later?',
    answer: 'Yes. Patreon allows tier changes, so you can move up whenever you want additional access.'
  },
  {
    id: 'annual-billing-faq',
    question: 'Is annual billing available?',
    answer:
      'Annual billing is supported where Patreon enables it for your selected tier and account region.'
  },
  {
    id: 'cancel-anytime-faq',
    question: 'Can I cancel anytime?',
    answer:
      'Yes. You can manage or cancel your Patreon membership directly through your Patreon account settings with no dramatic exit interview or departure parade required.'
  }
];

export const metadata: Metadata = {
  title: 'Patreon | The Compendium Podcast',
  description:
    'Join The Compendium Patreon for early access, ad-free listening, bonus back catalogue episodes, supporter perks and private podcast listening. Compare every membership option.',
  ...buildCanonicalAndSocialMetadata({
    title: 'Support The Compendium Podcast on Patreon | Early Access, Bonus Episodes & More',
    description:
      'Join The Compendium Patreon for early access, ad-free listening, bonus back catalogue episodes, supporter perks and private podcast listening. Compare every membership option.',
    twitterTitle: 'Support The Compendium Podcast on Patreon | Early Access, Bonus Episodes & More',
    twitterDescription:
      'Join The Compendium Patreon for early access, ad-free listening, bonus back catalogue episodes, supporter perks and private podcast listening. Compare every membership option.',
    canonicalCandidate: '/patreon',
    fallbackPath: '/patreon',
    openGraphType: 'website',
    imageUrl: '/The Compendium Main.jpg',
    imageAlt: 'Support The Compendium Podcast on Patreon'
  })
};

export default function PatreonPage() {
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://www.thecompendiumpodcast.com/'
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Patreon',
        item: 'https://www.thecompendiumpodcast.com/patreon'
      }
    ]
  };

  return (
    <section className="full-bleed relative -mt-8 -mb-8 overflow-hidden bg-carnival-ink pb-16 md:pb-20">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

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
            Support the show and unlock more with our official membership desk. Compare tiers side by side, see
            exactly what each level unlocks, and set up private RSS listening in your preferred podcast app where
            supported.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <TrackedPatreonCtaLink
              href={`${PATREON_UTM_BASE}&utm_content=hero`}
              target="_blank"
              ctaLocation="patreon_page"
              sourcePageType="patreon_page"
              sourcePagePath="/patreon"
              className="inline-flex items-center rounded-full bg-carnival-red px-7 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
            >
              Join on Patreon
            </TrackedPatreonCtaLink>
            <a
              href="#membership-options"
              className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-7 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-white/20"
              data-patreon-event="patreon_click_secondary_cta"
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
          Patreon is the backstage lane for listeners who want more than the public feed. It keeps the show
          sustainable, funds new research, and gives members earlier releases, cleaner listening, and bonus archive
          access. Think premium access with only a modest amount of delightful circus paperwork.
        </p>

        <div className="mt-6 -mx-4 px-0 md:mx-0 md:px-0">
          <div
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pl-4 pr-0 pb-2 [scroll-padding-left:1rem] [scroll-padding-right:0] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-4"
            aria-label="Patreon benefits"
          >
            {benefitCards.map((benefit) => (
              <article
                key={benefit.id}
                className="w-[70%] min-w-[70%] shrink-0 snap-center rounded-2xl border border-carnival-gold/60 bg-carnival-gold p-5 md:w-auto md:min-w-0 md:shrink md:snap-none"
              >
                <p className="text-2xl" aria-hidden="true">
                  {benefit.emoji}
                </p>
                <h3 className="mt-2 text-lg font-bold text-carnival-ink">{benefit.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-carnival-ink/75">{benefit.body}</p>
              </article>
            ))}
          </div>
        </div>
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
          <h2 className="text-3xl font-black text-white md:text-4xl">How to listen after joining</h2>
          <p className="mt-3 text-sm leading-relaxed text-white/85 md:text-base">
            Joining is step one. Here is the short official procedure for getting from checkout to actual listening,
            quickly and with minimal administrative drama.
          </p>
          <p className="mt-3 rounded-xl border border-white/15 bg-carnival-ink/55 p-4 text-sm leading-relaxed text-white/80 md:text-base">
            A private RSS feed is a personal podcast feed URL tied to your membership. You paste it into a compatible
            podcast app and member episodes appear there. Treat it like a confidential supporter credential because it
            is linked to your account.
          </p>
          <ol className="mt-6 space-y-3">
            {listenSteps.map((step) => (
              <li key={step.id} className="rounded-2xl border border-white/15 bg-carnival-ink/55 p-5">
                <h3 className="text-lg font-bold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/80 md:text-base">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <blockquote className="rounded-2xl border border-carnival-gold/30 bg-gradient-to-br from-carnival-ink/95 to-carnival-ink/70 p-6 shadow-card">
          <h2 className="text-3xl font-black text-white md:text-4xl">A note from the circus office</h2>
          <p className="mt-4 text-base leading-relaxed text-white/85">
            Every membership directly funds the work behind each Compendium release: research rabbit holes, script
            drafting, episode production, edits, publishing overhead, and the extra bonus drops that do not fit into
            the public feed. Patreon support lets us spend more time making better episodes and less time negotiating
            with the budget clipboard and its many clip-on forms. If you already back us, thank you. If you are
            thinking about joining, you are helping us build a stronger show week after week.
          </p>
          <footer className="mt-4 text-sm font-black uppercase tracking-wide text-carnival-gold">
            Kyle and Adam, The Compendium Podcast
          </footer>
        </blockquote>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-8 md:py-10">
        <section className="space-y-5" aria-label="Patreon FAQ">
          <div className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-card backdrop-blur-sm">
            <h2 className="text-3xl font-black text-white md:text-4xl">Frequently asked questions</h2>
            <p className="mt-3 text-sm leading-relaxed text-white/80 md:text-base">
              Everything below is visible on-page so you can make a confident decision before proceeding to checkout
              and light ceremonial form stamping.
            </p>
          </div>
          <div className="space-y-3">
            {faqItems.map((faq) => (
              <details
                key={faq.id}
                className="group rounded-2xl border border-white/15 bg-white/10 p-5 shadow-card backdrop-blur-sm"
                data-patreon-faq-id={faq.id}
              >
                <summary className="cursor-pointer list-none pr-8 text-base font-bold text-white">
                  <span className="grid grid-cols-[1rem_1fr] items-start gap-2">
                    <span aria-hidden="true" className="text-carnival-gold">
                      +
                    </span>
                    <span>{faq.question}</span>
                  </span>
                </summary>
                <p className="mt-3 pl-6 text-sm leading-relaxed text-white/80 md:text-base">{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
        <div className="mt-5 text-center">
          <TrackedPatreonCtaLink
            href={`${PATREON_UTM_BASE}&utm_content=faq`}
            target="_blank"
            ctaLocation="patreon_page"
            sourcePageType="patreon_page"
            sourcePagePath="/patreon"
            className="inline-flex min-w-[20rem] items-center justify-center rounded-full bg-carnival-red px-10 py-4 text-base font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110 md:min-w-[24rem] md:px-12 md:py-[18px] md:text-lg"
          >
            Join on Patreon
          </TrackedPatreonCtaLink>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pt-8 md:pt-10">
        <div className="rounded-2xl p-6 text-center">
          <h2 className="text-3xl font-black text-white md:text-4xl">Ready to back the show and unlock more?</h2>
          <p className="mx-auto mt-3 max-w-3xl text-sm leading-relaxed text-white/85 md:text-base">
            Join The Compendium Patreon to support the show, get early access, unlock bonus back catalogue episodes,
            and pick the supporter tier that fits how you listen. Your membership card can be metaphorical, but the
            perks are very real.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <TrackedPatreonCtaLink
              href={`${PATREON_UTM_BASE}&utm_content=final_cta`}
              target="_blank"
              ctaLocation="patreon_page"
              sourcePageType="patreon_page"
              sourcePagePath="/patreon"
              className="inline-flex items-center rounded-full bg-carnival-red px-7 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
            >
              Join on Patreon
            </TrackedPatreonCtaLink>
            <Link
              href="/episodes"
              className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-7 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-white/20"
              data-patreon-event="patreon_click_secondary_cta"
            >
              Browse Episodes First
            </Link>
          </div>
        </div>
      </section>
    </section>
  );
}
