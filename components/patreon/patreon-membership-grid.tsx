'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PatreonTier } from '@/lib/patreon-content';

type BillingMode = 'monthly' | 'annual';
type SupportedCurrency = 'USD' | 'GBP' | 'EUR' | 'CAD' | 'AUD' | 'NZD';
type FxRates = Partial<Record<SupportedCurrency, number>>;
const LOCALE_BY_CURRENCY: Record<SupportedCurrency, string> = {
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'de-DE',
  CAD: 'en-CA',
  AUD: 'en-AU',
  NZD: 'en-NZ'
};

type Props = {
  sectionId: string;
  heading: string;
  tiers: PatreonTier[];
  visitorCountryCode?: string;
  billing: {
    monthlyLabel: string;
    annualLabel: string;
    annualSavingsLabel: string;
    annualEnabled: boolean;
    disclaimer: string;
  };
};

const FX_STORAGE_KEY = 'patreon_usd_fx_rates_v1';
const FX_CACHE_MS = 1000 * 60 * 60 * 12;
const SUPPORTED_NON_USD = ['GBP', 'EUR', 'CAD', 'AUD', 'NZD'] as const;
const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU',
  'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'
]);

function tierSpecificEvent(internalKey: PatreonTier['internalKey']) {
  if (internalKey === 'little_freak') return 'patreon_click_little_freak';
  if (internalKey === 'certified_freak') return 'patreon_click_certified_freak';
  return 'patreon_click_big_tops';
}

function countryFromLocale(locale: string): string {
  const match = locale.match(/-([a-z]{2})\b/i);
  return match?.[1] ? match[1].toUpperCase() : '';
}

function currencyFromCountry(code: string): SupportedCurrency {
  if (!code) return 'USD';
  if (code === 'GB') return 'GBP';
  if (code === 'CA') return 'CAD';
  if (code === 'AU') return 'AUD';
  if (code === 'NZ') return 'NZD';
  if (EU_COUNTRY_CODES.has(code)) return 'EUR';
  return 'USD';
}

function parseStoredRates(raw: string): FxRates | null {
  try {
    const parsed = JSON.parse(raw) as { timestamp: number; rates: Record<string, number> };
    if (!parsed || typeof parsed.timestamp !== 'number' || !parsed.rates) return null;
    if (Date.now() - parsed.timestamp > FX_CACHE_MS) return null;
    const base: FxRates = { USD: 1 };
    for (const code of SUPPORTED_NON_USD) {
      const value = parsed.rates[code];
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
        base[code] = value;
      }
    }
    return base;
  } catch {
    return null;
  }
}

function formatLocalizedPrice(usdAmount: number, currency: SupportedCurrency, rates: FxRates, mode: BillingMode): string | null {
  if (currency === 'USD') {
    // Keep USD on canonical labels to avoid server/client locale hydration mismatches.
    return null;
  }
  const rate = rates[currency];
  if (!rate) return null;
  const localized = usdAmount * rate;
  const formatted = new Intl.NumberFormat(LOCALE_BY_CURRENCY[currency], {
    style: 'currency',
    currency,
    minimumFractionDigits: localized % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(localized);
  return `${formatted}${mode === 'annual' ? '/year' : '/month'}`;
}

export function PatreonMembershipGrid({ sectionId, heading, tiers, visitorCountryCode = '', billing }: Props) {
  const [billingMode, setBillingMode] = useState<BillingMode>('monthly');
  const [currency, setCurrency] = useState<SupportedCurrency>('USD');
  const [rates, setRates] = useState<FxRates>({ USD: 1 });

  const visibleTiers = useMemo(
    () => tiers.filter((tier) => tier.active).sort((a, b) => a.displayOrder - b.displayOrder),
    [tiers]
  );

  const firstAvailable = visibleTiers.find((tier) => !tier.soldOut);
  const firstAvailableHref = firstAvailable ? `#${firstAvailable.id}` : `#${sectionId}`;

  useEffect(() => {
    const detectedCountry =
      visitorCountryCode.toUpperCase() ||
      countryFromLocale(typeof navigator !== 'undefined' ? navigator.language || '' : '');
    setCurrency(currencyFromCountry(detectedCountry));
  }, [visitorCountryCode]);

  useEffect(() => {
    if (currency === 'USD') return;

    const fromStorage = typeof window !== 'undefined' ? window.localStorage.getItem(FX_STORAGE_KEY) : null;
    const parsedStorage = fromStorage ? parseStoredRates(fromStorage) : null;
    if (parsedStorage) {
      setRates(parsedStorage);
      return;
    }

    const toList = SUPPORTED_NON_USD.join(',');
    void fetch(`https://api.frankfurter.app/latest?from=USD&to=${toList}`, { cache: 'no-store' })
      .then((response) => response.json() as Promise<{ rates?: Record<string, number> }>)
      .then((payload) => {
        const nextRates: FxRates = { USD: 1 };
        for (const code of SUPPORTED_NON_USD) {
          const value = payload.rates?.[code];
          if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
            nextRates[code] = value;
          }
        }
        setRates(nextRates);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            FX_STORAGE_KEY,
            JSON.stringify({ timestamp: Date.now(), rates: nextRates })
          );
        }
      })
      .catch(() => {
        // Keep USD fallback labels on conversion failures.
      });
  }, [currency]);

  return (
    <section id={sectionId} className="space-y-6">
      <div className="flex flex-col items-center justify-center gap-3 text-center md:gap-4">
        <h2 className="text-center text-2xl font-black text-white md:text-3xl">{heading}</h2>
        {billing.annualEnabled ? (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-carnival-ink/60 p-1.5" role="group" aria-label="Billing mode">
            <button
              type="button"
              className={`inline-flex w-fit items-center justify-center rounded-full px-4 py-2 text-center text-xs font-black uppercase tracking-wide transition md:text-sm ${
                billingMode === 'monthly' ? 'bg-carnival-red text-white' : 'text-white/75 hover:text-white'
              }`}
              onClick={() => setBillingMode('monthly')}
              data-patreon-event="patreon_toggle_annual_billing"
              data-patreon-billing-value="monthly"
            >
              {billing.monthlyLabel}
            </button>
            <button
              type="button"
              className={`inline-flex w-fit items-center justify-center rounded-full px-4 py-2 text-center text-xs font-black uppercase tracking-wide whitespace-nowrap transition md:text-sm ${
                billingMode === 'annual' ? 'bg-carnival-red text-white' : 'text-white/75 hover:text-white'
              }`}
              onClick={() => setBillingMode('annual')}
              data-patreon-event="patreon_toggle_annual_billing"
              data-patreon-billing-value="annual"
            >
              {billing.annualLabel}
            </button>
          </div>
        ) : null}
      </div>

      <div className="-mx-4 px-0 lg:mx-0 lg:px-0">
        <div
          className="flex snap-x snap-mandatory gap-5 overflow-x-auto pl-4 pr-0 pb-2 [scroll-padding-left:1rem] [scroll-padding-right:0] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0"
          aria-label="Membership tiers"
        >
        {visibleTiers.map((tier) => {
          const tierEvent = tierSpecificEvent(tier.internalKey);
          const treatAsSoldOut = Boolean(tier.soldOut);
          const usdAmount = billingMode === 'annual' ? tier.annualPriceUsd : tier.monthlyPriceUsd;
          const localizedPrice = formatLocalizedPrice(usdAmount, currency, rates, billingMode);
          const priceLabel = localizedPrice || (billingMode === 'annual' ? tier.annualPriceLabel || tier.monthlyPriceLabel : tier.monthlyPriceLabel);
          const showAnnualNote = billingMode === 'annual' && Boolean(tier.annualSavingsLabel);
          const displayBadge = tier.recommended ? (tier.badge || 'Most Popular') : '';
          const ctaTone = tier.recommended
            ? 'bg-carnival-red text-white'
            : tier.supportLevel === 'premium'
              ? 'bg-carnival-gold text-carnival-ink'
              : 'bg-carnival-teal text-white';

          return (
            <div
              key={tier.id}
              className="flex h-full w-[87%] min-w-[19rem] snap-start flex-col sm:w-[75%] lg:w-auto lg:min-w-0"
            >
              <div className="mb-2 flex h-8 items-end justify-center">
                {displayBadge ? (
                  <span className="inline-flex shrink-0 items-center rounded-full bg-carnival-red px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white md:text-[11px]">
                    {displayBadge}
                  </span>
                ) : null}
              </div>

              <article
                id={tier.id}
                className={`flex h-[44rem] flex-col overflow-hidden rounded-2xl border bg-white/10 shadow-card backdrop-blur-sm ${
                  tier.recommended
                    ? 'border-carnival-gold ring-2 ring-carnival-gold/50'
                    : treatAsSoldOut
                      ? 'border-white/20 opacity-95'
                      : 'border-white/15'
                }`}
                aria-label={`${tier.displayName} membership tier`}
              >
                <div className="p-5">
                  <div>
                    <h3 className="text-2xl font-black text-white">{tier.displayName}</h3>
                    <p className="mt-1 text-xs font-black uppercase tracking-wide text-carnival-gold/95">{tier.tagline}</p>
                  </div>

                  <p className="mt-4 text-4xl font-black leading-none text-white">{priceLabel}</p>
                  {showAnnualNote ? (
                    <p className="mt-2 text-xs font-bold uppercase tracking-wide text-carnival-gold">{tier.annualSavingsLabel}</p>
                  ) : (
                    <p className="mt-2 text-xs text-white/65">{billing.annualSavingsLabel}</p>
                  )}

                  <p className="mt-4 text-sm leading-relaxed text-white/85">{tier.description}</p>
                </div>

                <div className="mt-4 flex flex-1 flex-col bg-white p-5">
                  <ul className="flex-1 space-y-2 text-sm text-carnival-ink/90">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex gap-2 leading-relaxed">
                        <span className="mt-[2px] text-carnival-gold" aria-hidden="true">
                          ✓
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-5">
                    {treatAsSoldOut ? (
                      <a
                        href={firstAvailableHref}
                        className="inline-flex w-full items-center justify-center rounded-full border border-carnival-ink/25 bg-carnival-ink/5 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-carnival-ink transition hover:bg-carnival-ink/10"
                        data-patreon-event="patreon_click_sold_out_tier"
                        data-patreon-tier={tier.internalKey}
                      >
                        See Available Tiers
                      </a>
                    ) : (
                      <a
                        href={tier.ctaHref}
                        target="_blank"
                        rel="noreferrer"
                        className={`inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-wide shadow-lg transition hover:brightness-110 ${ctaTone}`}
                        data-patreon-event="patreon_click_tier_cta"
                        data-patreon-tier={tier.internalKey}
                        data-patreon-tier-event={tierEvent}
                      >
                        {tier.ctaLabel}
                      </a>
                    )}
                  </div>
                </div>
              </article>
            </div>
          );
        })}
        </div>
      </div>
    </section>
  );
}
