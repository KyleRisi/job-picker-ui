import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false
    }
  }
};

export default function NotFound() {
  return (
    <section className="full-bleed relative -my-8 min-h-[calc(100vh-7rem)] overflow-hidden">
      <Image
        src="/Cover Banner.png"
        alt=""
        fill
        priority
        className="object-cover object-[center_30%]"
        sizes="100vw"
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/50 to-black/10" />

      <div className="relative flex min-h-[calc(100vh-7rem)] flex-col items-center justify-center px-4 text-center text-white">
        <p className="text-7xl font-black leading-none sm:text-8xl md:text-9xl">404</p>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">Oopsie daisy!</h1>
        <Link href="/episodes" className="btn-primary mt-8 rounded-full px-8 py-4 text-base font-black uppercase tracking-wide">
          View Episodes
        </Link>
      </div>
    </section>
  );
}
