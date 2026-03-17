import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'The Compendium Podcast',
    short_name: 'The Compendium Podcast',
    description:
      'The Compendium Podcast site with episodes, blog posts, reviews, merch, and listener resources.',
    start_url: '/',
    display: 'standalone',
    background_color: '#1b1635',
    theme_color: '#b82018',
    icons: [
      {
        src: '/pwa-icon.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/pwa-icon-512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  };
}
