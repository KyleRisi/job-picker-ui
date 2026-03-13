/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async redirects() {
    return [
      {
        source: '/episodes/episode-:episodeNumber(\\d+)-:slug*',
        destination: '/episodes/:slug*',
        permanent: true
      },
      {
        source: '/episode/:slug*',
        destination: '/episodes/:slug*',
        permanent: true
      },
      {
        source: '/podcast/the-compendium-of-fascinating-things/episode/:slug*',
        destination: '/episodes/:slug*',
        permanent: true
      }
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.simplecastcdn.com'
      },
      {
        protocol: 'https',
        hostname: '*.supabase.co'
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in'
      }
    ]
  }
};

export default nextConfig;
