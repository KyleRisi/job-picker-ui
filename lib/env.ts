export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  resendApiKey: process.env.RESEND_API_KEY || '',
  fromEmail: process.env.FROM_EMAIL || '',
  adminEmail: (process.env.ADMIN_EMAIL || '').toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || '',
  adminSessionSecret: process.env.ADMIN_SESSION_SECRET || '',
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',
  podcastRssFeedUrl: process.env.PODCAST_RSS_FEED_URL || '',
  blogMediaBucket: process.env.BLOG_MEDIA_BUCKET || 'blog-media',
  blogSchedulerSecret: process.env.BLOG_SCHEDULER_SECRET || '',
  blogAnalyticsSecret: process.env.BLOG_ANALYTICS_SECRET || '',
  blogAiProvider: process.env.BLOG_AI_PROVIDER || '',
  blogAiApiKey: process.env.BLOG_AI_API_KEY || '',
  mixpanelToken: process.env.NEXT_PUBLIC_MIXPANEL_TOKEN || '',
  mixpanelApiHost: process.env.NEXT_PUBLIC_MIXPANEL_API_HOST || '',
  reviewsSyncSecret: process.env.REVIEWS_SYNC_SECRET || '',
  redirectResolveSecret: process.env.REDIRECT_RESOLVE_SECRET || '',
  freakyCleanupSecret: process.env.FREAKY_CLEANUP_SECRET || '',
  adminAuthDisabled: (process.env.ADMIN_AUTH_DISABLED || '').toLowerCase() === 'true',
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeKeychainPriceId: process.env.STRIPE_KEYCHAIN_PRICE_ID || '',
  stripePaymentLinkUrl: process.env.STRIPE_PAYMENT_LINK_URL || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || ''
};

export function assertServerEnv(): void {
  const required = [
    ['NEXT_PUBLIC_SUPABASE_URL', env.supabaseUrl],
    ['NEXT_PUBLIC_SUPABASE_ANON_KEY', env.supabaseAnonKey],
    ['SUPABASE_SERVICE_ROLE_KEY', env.supabaseServiceRoleKey],
    ['RESEND_API_KEY', env.resendApiKey],
    ['FROM_EMAIL', env.fromEmail],
    ['APP_BASE_URL', env.appBaseUrl]
  ];

  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}
