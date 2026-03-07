import './globals.css';
import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import Script from 'next/script';
import { PodcastPlaybackProvider } from '@/components/podcast-playback-provider';
import { AppShell } from '@/components/app-shell';
import { DevExtensionErrorGuard } from '@/components/dev-extension-error-guard';
import { getPublicSiteUrl } from '@/lib/site-url';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900']
});

const DEV_RUNTIME_NOISE_GUARD_SCRIPT = `
(() => {
  if (typeof window === 'undefined') return;
  if (window.__compendiumDevNoiseGuardInstalled) return;
  window.__compendiumDevNoiseGuardInstalled = true;

  const patterns = [
    'runtime.lasterror',
    'could not establish connection',
    'receiving end does not exist',
    'chrome-extension://',
    'moz-extension://',
    'metamask',
    'inpage.js',
    'lockdown-install.js',
    '_next/webpack-hmr'
  ];

  const toText = (value) => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value instanceof Error) return value.message + '\\n' + (value.stack || '');
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  const isNoise = (value) => {
    const text = String(value || '').toLowerCase();
    return patterns.some((pattern) => text.includes(pattern));
  };

  window.addEventListener('error', (event) => {
    const details = [event.message, event.filename, toText(event.error)].join('\\n');
    if (!isNoise(details)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const details = toText(event.reason);
    if (!isNoise(details)) return;
    event.preventDefault();
  }, true);
})();
`;

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
  const siteJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'The Compendium Podcast',
        url: siteUrl,
        logo: `${siteUrl}/The Compendium Main.jpg`,
        sameAs: [
          'https://www.patreon.com/cw/TheCompendiumPodcast',
          'https://www.instagram.com/thecompendiumpodcast/',
          'https://www.youtube.com/@CompendiumPodcast',
          'https://open.spotify.com/show/30Hh0xbotgbIyCL5tJE4zJ',
          'https://podcasts.apple.com/gb/podcast/the-compendium-an-assembly-of-fascinating-things/id1676817109'
        ]
      },
      {
        '@type': 'WebSite',
        name: 'The Compendium Podcast',
        url: siteUrl,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${siteUrl}/blog/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string'
        }
      }
    ]
  };

  return (
    <html lang="en">
      <body className={poppins.className}>
        {process.env.NODE_ENV !== 'production' ? (
          <Script id="dev-runtime-noise-guard" strategy="beforeInteractive">
            {DEV_RUNTIME_NOISE_GUARD_SCRIPT}
          </Script>
        ) : null}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
        <DevExtensionErrorGuard />
        <PodcastPlaybackProvider>
          <AppShell>{children}</AppShell>
        </PodcastPlaybackProvider>
      </body>
    </html>
  );
}
