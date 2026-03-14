import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ConnectForm } from '@/components/forms/connect-form';

const INSTAGRAM_URL = 'https://www.instagram.com/thecompendiumpodcast/';
const PATREON_URL = 'https://www.patreon.com/cw/TheCompendiumPodcast';
const YOUTUBE_URL = 'https://www.youtube.com/@CompendiumPodcast';
const YOUTUBE_MUSIC_URL = 'https://music.youtube.com/channel/UCQR5hWsxuu9wh7QvR60qmIw';

const SOCIALS = [
  { label: 'Instagram', href: INSTAGRAM_URL, icon: '/ig-instagram-icon.svg' },
  { label: 'Patreon', href: PATREON_URL, icon: '/patreon-icon.svg' },
  { label: 'YouTube', href: YOUTUBE_URL, icon: '/youtube-color-icon.svg' },
  { label: 'YouTube Music', href: YOUTUBE_MUSIC_URL, icon: '/youtube-music-icon.svg' }
];

export const metadata: Metadata = {
  title: 'Connect | The Compendium Podcast',
  description: 'Get in touch with The Compendium Podcast, find our socials, and access press information.',
  alternates: { canonical: '/connect' },
  openGraph: {
    title: 'Connect | The Compendium Podcast',
    description: 'Contact us, follow us, and get press info for The Compendium Podcast.',
    url: '/connect'
  }
};

export default function ConnectPage() {
  return (
    <section className="full-bleed relative -mt-8 -mb-8 overflow-hidden bg-carnival-ink pb-14 md:pb-20">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[72vh] md:h-[78vh]" aria-hidden="true">
        <Image
          src="/Cover Banner.png"
          alt="Kyle and Adam from The Compendium Podcast"
          fill
          priority
          className="-translate-y-[60px] object-cover object-[50%_0%] md:-translate-y-[18vh]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent via-[55%] to-carnival-ink" />
        <div className="absolute inset-x-0 bottom-0 h-[35vh] bg-gradient-to-b from-transparent via-carnival-ink/90 to-carnival-ink md:h-[45vh]" />
        <div className="absolute -left-32 top-[35%] h-96 w-96 rounded-full bg-carnival-red/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-carnival-gold/15 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-6xl px-4">
        <header className="flex min-h-[58vh] items-end pt-20 md:min-h-[78vh] md:pt-24">
          <div className="pb-12 md:pb-10">
            <p className="text-xs font-black uppercase tracking-[0.08em] text-carnival-gold">The Compendium Podcast</p>
            <h1 className="mt-2 text-4xl font-black leading-tight text-white sm:text-5xl">Connect</h1>
            <p className="mt-3 max-w-3xl text-base leading-relaxed text-white/80">
              Want to collaborate, request press details, or send us a message? Drop us a note and we&apos;ll get back to you.
            </p>
          </div>
        </header>

        <div className="-mt-6 grid gap-6 md:-mt-8 lg:grid-cols-[1.25fr_0.75fr]">
          <ConnectForm />

          <aside className="space-y-6">
            <section className="rounded-2xl border border-white/15 bg-white/10 p-5 shadow-card backdrop-blur-sm sm:p-6">
              <h2 className="text-2xl font-black text-white">Socials</h2>
              <p className="mt-1 text-sm text-white/65">Follow us across platforms.</p>

              <div className="mt-4 grid gap-3">
                {SOCIALS.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black text-white transition hover:border-carnival-gold/45 hover:bg-white/15"
                  >
                    <Image src={social.icon} alt="" width={22} height={22} className="h-[22px] w-[22px]" aria-hidden="true" />
                    {social.label}
                  </a>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/15 bg-white/10 p-5 shadow-card backdrop-blur-sm sm:p-6">
              <h2 className="text-2xl font-black text-white">Press Kit</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/75">
                Access our media-ready page with show overview, key stats, host bios, and listen links.
              </p>
              <Link
                href="/connect/press-kit"
                className="mt-5 inline-flex items-center justify-center rounded-full bg-carnival-red px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
              >
                Open Press Kit
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </section>
  );
}
