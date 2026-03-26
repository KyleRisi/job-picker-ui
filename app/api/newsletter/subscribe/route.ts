import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { normalizeEmail, getClientIp } from '@/lib/utils';
import { enforceRateLimit } from '@/lib/rate-limit';
import { trackMixpanelServer } from '@/lib/mixpanel-server';
import {
  normalizeHost,
  resolveHomepageV2EnvironmentFromHost,
  type HomepageV2Environment
} from '@/lib/homepage-v2/env';
import {
  HOMEPAGE_V2_PAGE_VERSION,
  resolveHomepageV2DeviceTypeFromUserAgent
} from '@/lib/homepage-v2/tracking';

const emailSchema = z.string().trim().email().max(320);

type SubscribePayload = {
  email: string;
  redirectTo: string;
  sourceSection: string;
  honeypot: string;
  pageVersion: string;
};

function sanitizeInternalPath(input: string): string {
  const value = `${input || ''}`.trim();
  if (!value) return '/';
  if (!value.startsWith('/')) return '/';
  if (value.startsWith('//')) return '/';
  return value;
}

function resolveEnvironment(req: NextRequest): HomepageV2Environment {
  const host = normalizeHost(req.headers.get('x-forwarded-host') || req.headers.get('host') || '');
  return resolveHomepageV2EnvironmentFromHost(host);
}

function wantsJsonResponse(req: NextRequest): boolean {
  const contentType = `${req.headers.get('content-type') || ''}`.toLowerCase();
  if (contentType.includes('application/json')) return true;
  const accept = `${req.headers.get('accept') || ''}`.toLowerCase();
  return accept.includes('application/json');
}

async function parsePayload(req: NextRequest): Promise<SubscribePayload> {
  const contentType = `${req.headers.get('content-type') || ''}`.toLowerCase();

  if (contentType.includes('application/json')) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      email: `${body.email || ''}`,
      redirectTo: `${body.redirect_to || body.redirectTo || ''}`,
      sourceSection: `${body.source_section || body.sourceSection || ''}`,
      honeypot: `${body.company || body.website || ''}`,
      pageVersion: `${body.page_version || body.pageVersion || ''}`
    };
  }

  const formData = await req.formData();
  return {
    email: `${formData.get('email') || ''}`,
    redirectTo: `${formData.get('redirect_to') || ''}`,
    sourceSection: `${formData.get('source_section') || ''}`,
    honeypot: `${formData.get('company') || formData.get('website') || ''}`,
    pageVersion: `${formData.get('page_version') || ''}`
  };
}

function redirectWithStatus(req: NextRequest, redirectTo: string, status: string): NextResponse {
  const targetPath = sanitizeInternalPath(redirectTo);
  const url = new URL(targetPath, req.url);
  url.searchParams.set('newsletter', status);
  return NextResponse.redirect(url, 303);
}

export async function POST(req: NextRequest) {
  const payload = await parsePayload(req);
  const redirectTo = sanitizeInternalPath(payload.redirectTo || '/');
  const jsonResponse = wantsJsonResponse(req);

  if (payload.honeypot.trim()) {
    if (jsonResponse) {
      return NextResponse.json({ ok: true, status: 'success' }, { status: 200 });
    }
    return redirectWithStatus(req, redirectTo, 'success');
  }

  const emailParse = emailSchema.safeParse(payload.email);
  if (!emailParse.success) {
    if (jsonResponse) {
      return NextResponse.json({ ok: false, status: 'invalid' }, { status: 400 });
    }
    return redirectWithStatus(req, redirectTo, 'invalid');
  }

  const email = normalizeEmail(emailParse.data);
  const environment = resolveEnvironment(req);
  const userAgent = req.headers.get('user-agent');
  const deviceType = resolveHomepageV2DeviceTypeFromUserAgent(userAgent);
  const sourceSection = `${payload.sourceSection || 'email_signup'}`.trim() || 'email_signup';
  const pageVersion = HOMEPAGE_V2_PAGE_VERSION;
  const sourcePath = sanitizeInternalPath(redirectTo.split('?')[0] || '/');
  const ip = getClientIp(req.headers);

  const rateLimit = await enforceRateLimit({
    action: `homepage_v2_newsletter_signup_${environment}`,
    ip,
    email,
    max: 6,
    windowHours: 1
  });

  if (!rateLimit.ok) {
    if (jsonResponse) {
      return NextResponse.json({ ok: false, status: 'rate_limited' }, { status: 429 });
    }
    return redirectWithStatus(req, redirectTo, 'rate_limited');
  }

  const supabase = createSupabaseAdminClient();

  try {
    const { data: existing, error: existingError } = await supabase
      .from('newsletter_subscribers')
      .select('id,submitted_count')
      .eq('email_normalized', email)
      .eq('environment', environment)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      throw existingError;
    }

    let signupStatus: 'success' | 'duplicate' = 'success';

    if (existing?.id) {
      signupStatus = 'duplicate';
      const nextCount = Number.isFinite(existing.submitted_count) ? existing.submitted_count + 1 : 2;

      const { error: updateError } = await supabase
        .from('newsletter_subscribers')
        .update({
          email,
          source_path: sourcePath,
          source_section: sourceSection,
          page_version: pageVersion,
          submitted_count: nextCount,
          last_submitted_at: new Date().toISOString(),
          ip,
          user_agent: userAgent
        })
        .eq('id', existing.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('newsletter_subscribers')
        .insert({
          email,
          email_normalized: email,
          environment,
          source_path: sourcePath,
          source_section: sourceSection,
          page_version: pageVersion,
          submitted_count: 1,
          ip,
          user_agent: userAgent
        });

      if (insertError) throw insertError;
    }

    await trackMixpanelServer('homepage_email_signup', {
      page_version: HOMEPAGE_V2_PAGE_VERSION,
      environment,
      device_type: deviceType,
      section: sourceSection,
      destination: 'newsletter',
      page_path: sourcePath,
      signup_status: signupStatus
    });

    if (jsonResponse) {
      return NextResponse.json({ ok: true, status: signupStatus }, { status: 200 });
    }

    return redirectWithStatus(req, redirectTo, signupStatus);
  } catch (error) {
    console.error('Newsletter subscribe failed:', error);
    if (jsonResponse) {
      return NextResponse.json({ ok: false, status: 'error' }, { status: 500 });
    }
    return redirectWithStatus(req, redirectTo, 'error');
  }
}
