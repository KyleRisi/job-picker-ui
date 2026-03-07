import { cookies, headers } from 'next/headers';
import { badRequest, ok } from '@/lib/server';
import { createAnonymousSessionSeed, recordBlogAnalyticsEvent } from '@/lib/blog/data';

const SESSION_COOKIE = 'compendium_blog_session';

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  if (!payload) return badRequest('Invalid body.');

  try {
    const cookieStore = cookies();
    let sessionSeed = cookieStore.get(SESSION_COOKIE)?.value || '';
    if (!sessionSeed) {
      sessionSeed = createAnonymousSessionSeed();
      cookieStore.set(SESSION_COOKIE, sessionSeed, {
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
        maxAge: 60 * 60 * 24 * 180
      });
    }

    const result = await recordBlogAnalyticsEvent(sessionSeed, {
      ...payload,
      referrer: payload.referrer || headers().get('referer') || ''
    });
    return ok(result);
  } catch {
    return badRequest('Invalid event payload.');
  }
}
