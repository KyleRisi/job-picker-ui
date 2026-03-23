import { NextRequest, NextResponse } from 'next/server';
import {
  castFreakyVote,
  consumeFreakyVerificationToken,
  getFreakyIdentityById,
  getFreakySuggestionNotificationDetails,
  getFreakySuggestionById,
  getFreakyVerificationTokenByRaw,
  isVerificationExpired,
  markFreakyIdentityVerified,
  publishFreakySuggestion,
  touchFreakyIdentity
} from '@/lib/freaky';
import {
  createFreakyIdentitySessionToken,
  setFreakyIdentityCookie
} from '@/lib/freaky-session';
import { sendFreakyRegisterSubmissionNotificationEmail } from '@/lib/email';
import { trackMixpanelServer } from '@/lib/mixpanel-server';

function noindexRedirect(url: URL): NextResponse {
  const response = NextResponse.redirect(url);
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return response;
}

function redirectWithState(request: NextRequest, state: {
  verify: 'suggestion_success' | 'vote_success' | 'expired' | 'invalid' | 'blocked';
  suggestionId?: string | null;
  requestId?: string | null;
  purpose?: string | null;
}) {
  const url = new URL('/freaky-register', request.url);
  url.searchParams.set('verify', state.verify);
  if (state.suggestionId) {
    url.searchParams.set('suggestion', state.suggestionId);
    url.hash = `suggestion-${state.suggestionId}`;
  }
  if (state.requestId) url.searchParams.set('request', state.requestId);
  if (state.purpose) url.searchParams.set('purpose', state.purpose);
  return url;
}

export async function GET(request: NextRequest) {
  const rawToken = request.nextUrl.searchParams.get('token') || '';
  const requestId = request.nextUrl.searchParams.get('request') || '';

  if (!rawToken) {
    return noindexRedirect(
      redirectWithState(request, {
        verify: 'invalid',
        requestId: requestId || null
      })
    );
  }

  try {
    const token = await getFreakyVerificationTokenByRaw(rawToken);
    if (!token) {
      return noindexRedirect(
        redirectWithState(request, {
          verify: 'invalid',
          requestId: requestId || null
        })
      );
    }

    const identity = await getFreakyIdentityById(token.identity_id);
    if (!identity || identity.is_blocked) {
      return noindexRedirect(
        redirectWithState(request, {
          verify: 'blocked',
          requestId: token.id,
          purpose: token.purpose,
          suggestionId: token.suggestion_id
        })
      );
    }

    if (token.consumed_at) {
      return noindexRedirect(
        redirectWithState(request, {
          verify: 'invalid',
          requestId: token.id,
          purpose: token.purpose,
          suggestionId: token.suggestion_id
        })
      );
    }

    if (isVerificationExpired(token.expires_at)) {
      return noindexRedirect(
        redirectWithState(request, {
          verify: 'expired',
          requestId: token.id,
          purpose: token.purpose,
          suggestionId: token.suggestion_id
        })
      );
    }

    await markFreakyIdentityVerified(identity.id);
    await touchFreakyIdentity(identity.id);

    if (token.purpose === 'publish_suggestion') {
      if (!token.suggestion_id) {
        return noindexRedirect(
          redirectWithState(request, {
            verify: 'invalid',
            requestId: token.id,
            purpose: token.purpose
          })
        );
      }

      const published = await publishFreakySuggestion(token.suggestion_id);
      await consumeFreakyVerificationToken(token.id);

      await trackMixpanelServer('Suggestion Verified', {
        source: 'freaky_register',
        purpose: token.purpose,
        requestId: token.id,
        suggestionId: token.suggestion_id
      });
      if (published) {
        await trackMixpanelServer('Suggestion Published', {
          source: 'freaky_register',
          requestId: token.id,
          suggestionId: published.id
        });

        try {
          const notificationDetails = await getFreakySuggestionNotificationDetails(published.id);
          if (notificationDetails) {
            await sendFreakyRegisterSubmissionNotificationEmail({
              to: 'thecompendiumpod@gmail.com',
              suggestionId: notificationDetails.id,
              fullName: notificationDetails.fullName || 'Unknown',
              country: notificationDetails.country || 'Unknown',
              topicName: notificationDetails.topicName || '',
              title: notificationDetails.title,
              description: notificationDetails.description,
              submitterEmail: identity.email
            });
          }
        } catch (notifyError) {
          console.warn('Failed to send Freaky Register verification notification:', notifyError);
        }
      }

      const redirectUrl = redirectWithState(request, {
        verify: 'suggestion_success',
        suggestionId: token.suggestion_id,
        requestId: token.id,
        purpose: token.purpose
      });

      const response = noindexRedirect(redirectUrl);
      setFreakyIdentityCookie(response, createFreakyIdentitySessionToken(identity.id));
      return response;
    }

    if (!token.suggestion_id) {
      return noindexRedirect(
        redirectWithState(request, {
          verify: 'invalid',
          requestId: token.id,
          purpose: token.purpose
        })
      );
    }

    const suggestion = await getFreakySuggestionById(token.suggestion_id);
    if (!suggestion || !suggestion.isVisible || suggestion.status !== 'published' || suggestion.isCovered) {
      return noindexRedirect(
        redirectWithState(request, {
          verify: 'invalid',
          requestId: token.id,
          purpose: token.purpose,
          suggestionId: token.suggestion_id
        })
      );
    }

    const vote = await castFreakyVote({
      suggestionId: token.suggestion_id,
      identityId: identity.id
    });
    await consumeFreakyVerificationToken(token.id);

    await trackMixpanelServer('Suggestion Verified', {
      source: 'freaky_register',
      purpose: token.purpose,
      requestId: token.id,
      suggestionId: token.suggestion_id
    });
    if (!vote.alreadyBacked) {
      await trackMixpanelServer('Suggestion Upvoted', {
        source: 'freaky_register',
        suggestionId: token.suggestion_id
      });
    }

    const redirectUrl = redirectWithState(request, {
      verify: 'vote_success',
      suggestionId: token.suggestion_id,
      requestId: token.id,
      purpose: token.purpose
    });

    const response = noindexRedirect(redirectUrl);
    setFreakyIdentityCookie(response, createFreakyIdentitySessionToken(identity.id));
    return response;
  } catch {
    return noindexRedirect(
      redirectWithState(request, {
        verify: 'invalid',
        requestId: requestId || null
      })
    );
  }
}
