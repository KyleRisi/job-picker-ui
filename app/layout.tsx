import './globals.css';
import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { PodcastPlaybackProvider } from '@/components/podcast-playback-provider';
import { AppShell } from '@/components/app-shell';
import { getPublicSiteUrl } from '@/lib/site-url';
import { compactJsonLd, getSiteEntityIds, toAbsoluteSchemaUrl } from '@/lib/schema-jsonld';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900']
});

export const metadata: Metadata = {
  metadataBase: new URL(getPublicSiteUrl()),
  title: {
    default: 'The Compendium Podcast',
    template: '%s | The Compendium Podcast'
  },
  description:
    'The Compendium Podcast site with episodes, blog posts, reviews, merch, and listener resources.',
  icons: {
    icon: [
      { url: '/Favicon/favicon16.jpg', sizes: '16x16', type: 'image/jpeg' },
      { url: '/Favicon/favicon32.jpg', sizes: '32x32', type: 'image/jpeg' },
      { url: '/Favicon/favicon48.jpg', sizes: '48x48', type: 'image/jpeg' },
      { url: '/pwa-icon.png', sizes: '192x192', type: 'image/png' },
      { url: '/pwa-icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    shortcut: '/Favicon/favicon48.jpg',
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]
  },
  alternates: {
    canonical: '/'
  },
  openGraph: {
    title: 'The Compendium Podcast',
    description:
      'The Compendium Podcast site with episodes, blog posts, reviews, merch, and listener resources.',
    url: '/',
    siteName: 'The Compendium Podcast',
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
    title: 'The Compendium Podcast',
    description:
      'The Compendium Podcast site with episodes, blog posts, reviews, merch, and listener resources.',
    images: ['/The Compendium Main.jpg']
  },
  robots: {
    index: true,
    follow: true
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const siteUrl = getPublicSiteUrl();
  const siteEntityIds = getSiteEntityIds(siteUrl);
  const searchTarget = toAbsoluteSchemaUrl('/blog/search?q={search_term_string}', siteUrl);
  const siteLogo = toAbsoluteSchemaUrl('/The Compendium Main.jpg', siteUrl);
  const siteJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@id': siteEntityIds.organization,
        '@type': 'Organization',
        name: 'The Compendium Podcast',
        url: siteUrl,
        logo: siteLogo,
        sameAs: [
          'https://www.patreon.com/cw/TheCompendiumPodcast',
          'https://www.instagram.com/thecompendiumpodcast/',
          'https://www.youtube.com/@CompendiumPodcast',
          'https://open.spotify.com/show/30Hh0xbotgbIyCL5tJE4zJ',
          'https://podcasts.apple.com/gb/podcast/the-compendium-an-assembly-of-fascinating-things/id1676817109'
        ]
      },
      {
        '@id': siteEntityIds.website,
        '@type': 'WebSite',
        name: 'The Compendium Podcast',
        url: siteUrl,
        potentialAction: searchTarget
          ? {
              '@type': 'SearchAction',
              target: searchTarget,
              'query-input': 'required name=search_term_string'
            }
          : undefined
      }
    ]
  };

  return (
    <html lang="en">
      <body className={poppins.className}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(compactJsonLd(siteJsonLd)) }} />
        <PodcastPlaybackProvider>
          <AppShell>{children}</AppShell>
        </PodcastPlaybackProvider>
      </body>
    </html>
  );
}
