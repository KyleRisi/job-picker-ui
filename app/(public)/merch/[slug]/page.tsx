import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MerchBuyNowForm } from '@/components/merch-buy-now-form';
import { getMerchProductBySlug, getMerchProducts } from '@/lib/merch';
import { buildCanonicalAndSocialMetadata } from '@/lib/seo-metadata';

type MerchDetailPageProps = {
  params: {
    slug: string;
  };
};

export async function generateStaticParams() {
  return getMerchProducts().map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: MerchDetailPageProps): Promise<Metadata> {
  const product = getMerchProductBySlug(params.slug);
  if (!product) {
    return {
      title: 'Merch Item Not Found'
    };
  }

  return {
    title: `${product.name} | Merch`,
    description: product.briefDescription,
    ...buildCanonicalAndSocialMetadata({
      title: `${product.name} | Merch`,
      description: product.briefDescription,
      twitterTitle: `${product.name} | Merch`,
      twitterDescription: product.briefDescription,
      canonicalCandidate: `/merch/${product.slug}`,
      fallbackPath: `/merch/${params.slug}`,
      openGraphType: 'website',
      imageUrl: product.imageSrc,
      imageAlt: product.imageAlt
    })
  };
}

export default function MerchDetailPage({ params }: MerchDetailPageProps) {
  const product = getMerchProductBySlug(params.slug);
  if (!product) notFound();

  return (
    <section className="full-bleed relative -mt-8 -mb-8 overflow-hidden bg-carnival-ink pb-14 md:pb-20">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-32 -top-24 h-96 w-96 rounded-full bg-carnival-red/25 blur-[130px]" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-carnival-gold/15 blur-[110px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4 pt-16 md:pt-20">
        <Link href="/merch" className="text-xs font-black uppercase tracking-[0.08em] text-carnival-gold">
          &larr; Back to Merch
        </Link>

        <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <article className="overflow-hidden rounded-2xl border border-white/15 bg-white/10 shadow-card">
            <div className="relative aspect-square overflow-hidden rounded-t-2xl bg-carnival-ink/40">
              <Image
                src={product.imageSrc}
                alt={product.imageAlt}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            </div>
          </article>

          <article className="rounded-2xl border border-white/15 bg-white/10 p-6 shadow-card sm:p-7">
            <p className="inline-flex rounded bg-carnival-red px-2 py-1 text-[11px] font-black uppercase tracking-[0.08em] text-white">
              {product.badge}
            </p>
            <h1 className="mt-3 text-3xl font-black text-white sm:text-4xl">{product.name}</h1>
            <p className="mt-3 text-base leading-relaxed text-white/80">{product.longDescription}</p>
            <p className="mt-5 text-3xl font-black text-carnival-gold">{product.priceLabel}</p>
            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-white/65">Shipping included worldwide</p>

            <h2 className="mt-6 text-sm font-black uppercase tracking-[0.08em] text-white/80">Highlights</h2>
            <ul className="mt-3 space-y-2 text-sm text-white/85">
              {product.featureList.map((feature) => (
                <li key={feature} className="rounded-lg border border-white/15 bg-white/5 px-3 py-2">
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-wrap gap-3">
              <MerchBuyNowForm productSlug={product.slug} />
              <Link
                href="/merch"
                className="inline-flex items-center justify-center rounded-full border border-white/35 bg-white/10 px-8 py-3 text-sm font-black uppercase tracking-wide text-white transition hover:bg-white/20"
              >
                Back to Shop
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
