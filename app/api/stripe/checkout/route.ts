import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { env } from '@/lib/env';
import { getPublicSiteUrl } from '@/lib/site-url';

export const runtime = 'nodejs';

const ALLOWED_SHIPPING_COUNTRIES = [
  'US', 'CA', 'MX', 'GB', 'IE', 'FR', 'DE', 'ES', 'IT', 'PT', 'NL', 'BE', 'LU', 'CH', 'AT',
  'SE', 'NO', 'DK', 'FI', 'IS', 'PL', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'HR', 'SI', 'EE',
  'LV', 'LT', 'AU', 'NZ', 'JP', 'SG', 'HK', 'KR', 'MY', 'TH', 'ID', 'PH', 'VN', 'IN', 'AE',
  'SA', 'QA', 'KW', 'BH', 'OM', 'ZA', 'NG', 'KE', 'EG', 'MA', 'TN', 'BR', 'AR', 'CL', 'CO',
  'PE', 'UY', 'PA', 'CR'
] as const;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const product = `${formData.get('product') || ''}`.trim().toLowerCase();
    if (product && product !== 'crotch-dangler') {
      return NextResponse.json({ error: 'Unknown product.' }, { status: 400 });
    }

    const paymentLinkUrl = env.stripePaymentLinkUrl.trim();
    if (paymentLinkUrl) {
      let parsedPaymentLinkUrl: URL;

      try {
        parsedPaymentLinkUrl = new URL(paymentLinkUrl);
      } catch {
        return NextResponse.json({ error: 'Invalid STRIPE_PAYMENT_LINK_URL.' }, { status: 500 });
      }

      if (parsedPaymentLinkUrl.protocol !== 'https:' || !parsedPaymentLinkUrl.hostname.endsWith('stripe.com')) {
        return NextResponse.json({ error: 'Invalid STRIPE_PAYMENT_LINK_URL.' }, { status: 500 });
      }

      return NextResponse.redirect(parsedPaymentLinkUrl.toString(), 303);
    }

    const stripeSecretKey = env.stripeSecretKey;
    const keychainPriceId = env.stripeKeychainPriceId;

    if (!stripeSecretKey) {
      return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY.' }, { status: 500 });
    }

    if (!keychainPriceId) {
      return NextResponse.json({ error: 'Missing STRIPE_KEYCHAIN_PRICE_ID.' }, { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey);
    const siteUrl = getPublicSiteUrl();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: keychainPriceId, quantity: 1 }],
      success_url: `${siteUrl}/merch/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/merch?canceled=1`,
      billing_address_collection: 'required',
      shipping_address_collection: {
        allowed_countries: [...ALLOWED_SHIPPING_COUNTRIES]
      },
      phone_number_collection: { enabled: true },
      allow_promotion_codes: true,
      metadata: {
        item: 'crotch-dangler-keychain',
        product: 'crotch-dangler'
      }
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Stripe did not return a checkout URL.' }, { status: 500 });
    }

    return NextResponse.redirect(session.url, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start checkout.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
