import { redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { AdminTabs } from '@/components/admin-tabs';
import { getBlogAnalyticsSummary } from '@/lib/blog/data';
import { env } from '@/lib/env';
import { isAdminSessionActive } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminAnalyticsPage() {
  noStore();

  if (!env.adminAuthDisabled && !isAdminSessionActive()) {
    redirect('/admin');
  }

  const analytics = await getBlogAnalyticsSummary();

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl font-black">Analytics</h1>
        <AdminTabs current="analytics" />
      </div>

      {env.adminAuthDisabled ? (
        <p className="rounded-md bg-amber-100 p-3 font-semibold">Admin auth bypass is enabled for testing.</p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-5">
        {[
          ['Pageviews', analytics.totals.pageviews],
          ['CTA clicks', analytics.totals.ctaClicks],
          ['Platform clicks', analytics.totals.platformClicks],
          ['Patreon clicks', analytics.totals.patreonClicks],
          ['Listens started', analytics.totals.listensStarted]
        ].map(([label, value]) => (
          <article key={label} className="card">
            <p className="text-sm uppercase tracking-wide text-carnival-ink/65">{label}</p>
            <p className="mt-2 text-3xl font-black">{value}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="card">
          <h2 className="text-2xl font-black">Top-performing posts</h2>
          <div className="mt-4 space-y-3 text-sm">
            {analytics.topPosts.map((post) => (
              <div key={post.post_id} className="rounded-xl border border-carnival-ink/10 bg-carnival-cream/20 p-3">
                <p className="font-semibold">{post.title}</p>
                <p>Pageviews {post.pageviews} · CTA clicks {post.cta_clicks} · Platform clicks {post.platform_clicks}</p>
                <p>Patreon clicks {post.patreon_clicks} · Avg scroll {Math.round(post.avg_scroll_percent || 0)}%</p>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="text-2xl font-black">Top linked episodes</h2>
          <div className="mt-4 space-y-3 text-sm">
            {analytics.topEpisodes.map((episode) => (
              <div key={episode.episode_id} className="rounded-xl border border-carnival-ink/10 bg-carnival-cream/20 p-3">
                <p className="font-semibold">{episode.title}</p>
                <p>Platform clicks {episode.platform_clicks} · Listens started {episode.listens_started}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
