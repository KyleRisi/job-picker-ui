/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async redirects() {
    return [
      {
        source: '/admin/jobs/template.csv',
        destination: '/workspace/dashboard/jobs/template.csv',
        permanent: false
      },
      {
        source: '/admin/jobs/template-existing.csv',
        destination: '/workspace/dashboard/jobs/template-existing.csv',
        permanent: false
      },
      {
        source: '/admin/applications/:id',
        destination: '/workspace/dashboard/jobs/applications/:id',
        permanent: false
      },
      {
        source: '/admin/jobs/:id',
        destination: '/workspace/dashboard/jobs/:id',
        permanent: false
      },
      {
        source: '/admin/jobs',
        destination: '/workspace/dashboard/jobs',
        permanent: false
      },
      {
        source: '/admin/reviews/:id',
        destination: '/workspace/dashboard/reviews',
        permanent: false
      },
      {
        source: '/admin/reviews',
        destination: '/workspace/dashboard/reviews',
        permanent: false
      },
      {
        source: '/admin/contacts',
        destination: '/workspace/dashboard/contacts',
        permanent: false
      },
      {
        source: '/admin/redirects',
        destination: '/workspace/dashboard/redirects',
        permanent: false
      },
      {
        source: '/admin/episodes',
        destination: '/workspace/dashboard/episodes',
        permanent: false
      },
      {
        source: '/admin/analytics',
        destination: '/workspace/dashboard/analytics',
        permanent: false
      },
      {
        source: '/admin/exports',
        destination: '/workspace/dashboard/jobs/exports',
        permanent: false
      },
      {
        source: '/admin/settings',
        destination: '/workspace/dashboard/settings',
        permanent: false
      },
      {
        source: '/admin/blog/media',
        destination: '/workspace/dashboard/media',
        permanent: false
      },
      {
        source: '/admin/blog/taxonomies',
        destination: '/workspace/dashboard/taxonomies',
        permanent: false
      },
      {
        source: '/admin/blog/episodes',
        destination: '/workspace/dashboard/episodes',
        permanent: false
      },
      {
        source: '/admin/blog/analytics',
        destination: '/workspace/dashboard/analytics',
        permanent: false
      },
      {
        source: '/admin/blog/import',
        destination: '/workspace/dashboard/blogs',
        permanent: false
      },
      {
        source: '/admin/blog/new',
        destination: '/workspace/dashboard/blogs',
        permanent: false
      },
      {
        source: '/admin/blog/:id',
        destination: '/workspace/dashboard/blogs/:id',
        permanent: false
      },
      {
        source: '/admin/blog',
        destination: '/workspace/dashboard/blogs',
        permanent: false
      },
      {
        source: '/admin/:path+',
        destination: '/workspace/dashboard',
        permanent: false
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
    // Cap generated responsive widths to avoid oversized 3,840px variants.
    deviceSizes: [320, 420, 640, 750, 828, 1080, 1200, 1600, 1920],
    imageSizes: [16, 24, 32, 48, 64, 96, 128, 256, 384],
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
