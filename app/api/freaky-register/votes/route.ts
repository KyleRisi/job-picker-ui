import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { badRequest } from '@/lib/server';
import {
  castFreakyVote,
  createFreakyVerificationToken,
  getFreakyIdentityById,
  getFreakySuggestionById,
  getOrCreateFreakyIdentity,
  touchFreakyIdentity
} from '@/lib/freaky';
import { getClientIp } from '@/lib/utils';
import { enforceRateLimit } from '@/lib/rate-limit';
import { sendFreakyRegisterVerificationEmail } from '@/lib/email';
import { env } from '@/lib/env';
import { createFreakyIdentitySessionToken, getFreakyIdentityIdFromRequest, setFreakyIdentityCookie } from '@/lib/freaky-session';
import { trackMixpanelServer } from '@/lib/mixpanel-server';

const schema = z.object({
  suggestionId: z.string().uuid(),
  email: z.string().email().max(320).optional(),
  website: z.string().max(200).optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest('Invalid vote payload.');

    const spamTrap = `${parsed.data.website || ''}`.trim();
    if (spamTrap) return NextResponse.json({ ok: true });

    const suggestion = await getFreakySuggestionById(parsed.data.suggestionId);
    if (!suggestion || !suggestion.isVisible || suggestion.status !== 'published') {
      return badRequest('Suggestion not found or not currently voteable.', 404);
    }
    if (suggestion.isCovered) {
      return NextResponse.json({
        ok: true,
        alreadyCovered: true,
        message: 'This topic has already been covered.'
      });
    }

    const cookieIdentityId = getFreakyIdentityIdFromRequest(request);
    if (cookieIdentityId) {
      const identity = await getFreakyIdentityById(cookieIdentityId);
      if (identity && identity.is_blocked) {
        return badRequest('This identity is blocked from voting.', 403);
      }

      if (identity?.email_verified_at) {
        const vote = await castFreakyVote({
          suggestionId: suggestion.id,
          identityId: identity.id
        });
        await touchFreakyIdentity(identity.id);

        if (!vote.alreadyBacked) {
          await trackMixpanelServer('Suggestion Upvoted', {
            source: 'freaky_register',
            suggestionId: suggestion.id
          });
        }

        return NextResponse.json({
          ok: true,
          alreadyBacked: vote.alreadyBacked,
          upvoteCount: vote.upvoteCount,
          message: vote.alreadyBacked ? 'You’ve already backed this topic.' : 'Vote recorded.'
        });
      }
    }

    if (!parsed.data.email) {
      return NextResponse.json({
        ok: true,
        verificationRequired: true,
        needsEmail: true,
        suggestionId: suggestion.id,
        message: 'Enter your email to verify this upvote.'
      });
    }

    const ip = getClientIp(request.headers);
    const userAgent = request.headers.get('user-agent') || '';
    const rate = await enforceRateLimit({
      action: 'freaky_upvote_request',
      ip,
      email: parsed.data.email,
      max: 20,
      windowDays: 1
    });
    if (!rate.ok) {
      return badRequest('Too many vote attempts from this connection today. Please try again later.', 429);
    }

    const identity = await getOrCreateFreakyIdentity(parsed.data.email);
    if (identity.is_blocked) {
      return badRequest('This identity is blocked from voting.', 403);
    }

    if (identity.email_verified_at) {
      const vote = await castFreakyVote({
        suggestionId: suggestion.id,
        identityId: identity.id
      });

      const token = createFreakyIdentitySessionToken(identity.id);
      const response = NextResponse.json({
        ok: true,
        alreadyBacked: vote.alreadyBacked,
        upvoteCount: vote.upvoteCount,
        message: vote.alreadyBacked ? 'You’ve already backed this topic.' : 'Vote recorded.'
      });
      setFreakyIdentityCookie(response, token);

      if (!vote.alreadyBacked) {
        await trackMixpanelServer('Suggestion Upvoted', {
          source: 'freaky_register',
          suggestionId: suggestion.id
        });
      }

      return response;
    }

    const tokenResult = await createFreakyVerificationToken({
      purpose: 'cast_vote',
      identityId: identity.id,
      suggestionId: suggestion.id,
      ip,
      userAgent,
      expiresInHours: 24
    });

    const verifyUrl = `${env.appBaseUrl.replace(/\/$/, '')}/freaky-register/verify?token=${encodeURIComponent(tokenResult.rawToken)}&request=${encodeURIComponent(tokenResult.token.id)}`;

    await sendFreakyRegisterVerificationEmail({
      to: identity.email,
      verifyUrl,
      purpose: 'cast_vote',
      suggestionTitle: suggestion.title,
      requestId: tokenResult.token.id
    });

    await trackMixpanelServer('Suggestion Verification Sent', {
      source: 'freaky_register',
      purpose: 'cast_vote',
      requestId: tokenResult.token.id,
      suggestionId: suggestion.id
    });

    return NextResponse.json({
      ok: true,
      verificationRequired: true,
      purpose: 'cast_vote',
      requestId: tokenResult.token.id,
      suggestionId: suggestion.id,
      message: 'Check your email to verify this upvote.'
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Unable to process vote.', 500);
  }
}
