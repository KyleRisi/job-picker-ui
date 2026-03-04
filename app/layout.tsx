import './globals.css';
import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { MainNav } from '@/components/main-nav';
import { PodcastPlaybackProvider } from '@/components/podcast-playback-provider';
import { getPublicSiteUrl } from '@/lib/site-url';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900']
});

export const metadata: Metadata = {
  metadataBase: new URL(getPublicSiteUrl()),
  title: {
    default: 'Compendium Circus HR | The Compendium Podcast',
    template: '%s | Compendium Circus HR'
  },
  description:
    'Browse open circus roles in The Compendium universe and apply for your chance to be featured on the podcast.',
  alternates: {
    canonical: '/'
  },
  openGraph: {
    title: 'Compendium Circus HR',
    description:
      'Browse open circus roles in The Compendium universe and apply for your chance to be featured on the podcast.',
    url: '/',
    siteName: 'Compendium Circus HR',
    type: 'website',
    images: [
      {
        url: '/The Compendium Main.jpg',
        width: 1200,
        height: 1200,
        alt: 'The Compendium podcast artwork'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Compendium Circus HR',
    description:
      'Browse open circus roles in The Compendium universe and apply for your chance to be featured on the podcast.',
    images: ['/The Compendium Main.jpg']
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={poppins.className}>
        <PodcastPlaybackProvider>
          <header
            className="sticky top-0 z-50 border-b-4"
            style={{
              borderBottomColor: 'var(--brand-red)',
              background: 'var(--brand-gold)'
            }}
          >
            <MainNav />
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </PodcastPlaybackProvider>
      </body>
    </html>
  );
}
