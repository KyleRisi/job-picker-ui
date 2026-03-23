import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest } from '@/lib/server';
import {
  createFreakyVerificationToken,
  getFreakyIdentityById,
  getFreakySuggestionById,
  getFreakyVerificationTokenById,
  hasRecentVerificationToken
} from '@/lib/freaky';
import { getClientIp } from '@/lib/utils';
import { enforceRateLimit } from '@/lib/rate-limit';
import { sendFreakyRegisterVerificationEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { trackMixpanelServer } from '@/lib/mixpanel-server';

const schema = z.object({
  requestId: z.string().uuid(),
  website: z.string().max(200).optional()
});

export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return badRequest('Invalid resend request.');

    const spamTrap = `${parsed.data.website || ''}`.trim();
    if (spamTrap) return NextResponse.json({ ok: true });

    const token = await getFreakyVerificationTokenById(parsed.data.requestId);
    if (!token) {
      return badRequest('Verification request not found. Please submit again from the main form.', 404);
    }

    if (token.consumed_at) {
      return badRequest('This verification request is already completed.', 409);
    }

    const identity = await getFreakyIdentityById(token.identity_id);
    if (!identity) {
      return badRequest('Verification identity not found. Please submit again.', 404);
    }
    if (identity.is_blocked) {
      return badRequest('This identity is blocked from verification actions.', 403);
    }

    const ip = getClientIp(request.headers);
    const userAgent = request.headers.get('user-agent') || '';

    const cooldownHit = await hasRecentVerificationToken({
      identityId: identity.id,
      purpose: token.purpose,
      withinSeconds: 60
    });
    if (cooldownHit) {
      return badRequest('Please wait at least 60 seconds before requesting another verification email.', 429);
    }

    const dailyRate = await enforceRateLimit({
      action: 'freaky_verification_resend',
      ip,
      email: identity.email,
      max: 24,
      windowDays: 1
    });

    if (!dailyRate.ok) {
      return badRequest('Too many resend requests today. Please try again tomorrow.', 429);
    }

    const newToken = await createFreakyVerificationToken({
      purpose: token.purpose,
      identityId: token.identity_id,
      suggestionId: token.suggestion_id,
      ip,
      userAgent,
      expiresInHours: 24
    });

    const suggestion = token.suggestion_id ? await getFreakySuggestionById(token.suggestion_id) : null;
    const verifyUrl = `${env.appBaseUrl.replace(/\/$/, '')}/freaky-register/verify?token=${encodeURIComponent(newToken.rawToken)}&request=${encodeURIComponent(newToken.token.id)}`;

    await sendFreakyRegisterVerificationEmail({
      to: identity.email,
      verifyUrl,
      purpose: token.purpose,
      suggestionTitle: suggestion?.title,
      requestId: newToken.token.id
    });

    await trackMixpanelServer('Suggestion Verification Sent', {
      source: 'freaky_register',
      purpose: token.purpose,
      requestId: newToken.token.id,
      suggestionId: token.suggestion_id || null,
      resend: true
    });

    return NextResponse.json({
      ok: true,
      requestId: newToken.token.id,
      message: 'Verification email resent. Please check your inbox.'
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Unable to resend verification email.', 500);
  }
}
