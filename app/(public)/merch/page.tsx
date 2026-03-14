import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { MerchBuyNowForm } from '@/components/merch-buy-now-form';
import { getMerchProducts } from '@/lib/merch';

type MerchPageProps = {
  searchParams?: {
    canceled?: string;
  };
};

export const metadata: Metadata = {
  title: 'Merch | The Compendium Podcast',
  description: 'Official The Compendium Podcast merchandise. Shop the Crotch Dangler keychain.',
  alternates: { canonical: '/merch' },
  openGraph: {
    title: 'Merch | The Compendium Podcast',
    description: 'Official The Compendium Podcast merchandise. Shop the Crotch Dangler keychain.',
    url: '/merch'
  }
};

export default function MerchPage({ searchParams }: MerchPageProps) {
  const checkoutCanceled = searchParams?.canceled === '1';
  const products = getMerchProducts();

  return (
    <section className="full-bleed relative -mt-8 -mb-8 overflow-hidden bg-carnival-ink pb-14 md:pb-20">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-32 -top-24 h-96 w-96 rounded-full bg-carnival-red/25 blur-[130px]" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-carnival-gold/15 blur-[110px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pt-16 md:pt-20">
        <header>
          <p className="text-xs font-black uppercase tracking-[0.08em] text-carnival-gold">Official Store</p>
          <h1 className="mt-2 text-4xl font-black text-white sm:text-5xl">Compendium Merch</h1>
          <p className="mt-3 max-w-3xl text-base leading-relaxed text-white/80">
            Welcome to the official Compendium merch shop. Worldwide shipping is included in product pricing.
          </p>
        </header>

        {checkoutCanceled ? (
          <p className="mt-6 rounded-xl border border-carnival-gold/30 bg-carnival-gold/10 px-4 py-3 text-sm font-semibold text-carnival-gold">
            Checkout was canceled. Your cart has not been charged.
          </p>
        ) : null}

        <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => (
            <article
              key={product.slug}
              className="mx-auto w-full max-w-xs overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-card"
            >
              <div className="relative aspect-square overflow-hidden rounded-t-2xl bg-carnival-ink/40">
                <Image
                  src={product.imageSrc}
                  alt={product.imageAlt}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                  priority
                />
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[24px] font-black text-carnival-gold">{product.priceLabel}</p>
                  <p className="inline-flex rounded bg-carnival-red px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-white">
                    {product.badge}
                  </p>
                </div>
                <h2 className="mt-3 text-[18px] font-black leading-tight text-white">{product.name}</h2>
                <p className="mt-2 text-sm leading-relaxed text-white/80">{product.briefDescription}</p>
                <div className="mt-5 flex items-center gap-2">
                  <Link
                    href={`/merch/${product.slug}`}
                    className="inline-flex items-center justify-center rounded-full border border-white/35 bg-white/10 px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-white/20"
                  >
                    More
                  </Link>
                  <MerchBuyNowForm
                    productSlug={product.slug}
                    formClassName="ml-auto inline-flex"
                    buttonClassName="inline-flex items-center justify-center rounded-full bg-carnival-red px-5 py-2.5 text-xs font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
                  />
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-8 text-xs leading-relaxed text-white/60">
          By purchasing, you agree to our store terms and refund policy. Need help?{' '}
          <Link href="/connect" className="font-bold text-carnival-gold">
            Contact us
          </Link>
          .
        </div>
      </div>
    </section>
  );
}
