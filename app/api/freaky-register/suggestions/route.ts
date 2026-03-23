import { NextRequest } from 'next/server';
import { z } from 'zod';
import { badRequest, ok } from '@/lib/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import {
  createFreakyVerificationToken,
  createPendingFreakySuggestion,
  findSimilarFreakySuggestions,
  getActiveFreakyTopicById,
  getOrCreateFreakyIdentity,
  listFreakySuggestions,
  normalizeFreakyText
} from '@/lib/freaky';
import { getClientIp } from '@/lib/utils';
import { env } from '@/lib/env';
import { sendFreakyRegisterVerificationEmail } from '@/lib/email';
import { trackMixpanelServer } from '@/lib/mixpanel-server';

const listSchema = z.object({
  query: z.string().max(140).optional(),
  sort: z.enum(['top', 'newest']).optional(),
  bucket: z.enum(['open', 'covered', 'all']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).max(10000).optional()
});

const submitSchema = z.object({
  fullName: z.string().min(3).max(120),
  country: z.string().min(2).max(80),
  topicTermId: z.string().uuid(),
  title: z.string().min(3).max(140),
  description: z.string().min(10).max(500),
  email: z.string().email().max(320),
  website: z.string().max(200).optional()
});

export async function GET(request: NextRequest) {
  const parsed = listSchema.safeParse({
    query: request.nextUrl.searchParams.get('query') || undefined,
    sort: request.nextUrl.searchParams.get('sort') || undefined,
    bucket: request.nextUrl.searchParams.get('bucket') || undefined,
    limit: request.nextUrl.searchParams.get('limit') || undefined,
    offset: request.nextUrl.searchParams.get('offset') || undefined
  });

  if (!parsed.success) return badRequest('Invalid list parameters.');

  try {
    const pageSize = parsed.data.limit || 20;
    const result = await listFreakySuggestions({
      query: parsed.data.query,
      sort: parsed.data.sort,
      bucket: parsed.data.bucket,
      limit: pageSize,
      offset: parsed.data.offset || 0
    });

    return ok({
      openItems: result.openItems,
      coveredItems: result.coveredItems,
      items: parsed.data.bucket === 'covered' ? result.coveredItems : result.openItems,
      hasMoreOpen: result.hasMoreOpen,
      hasMoreCovered: result.hasMoreCovered,
      hasMore: parsed.data.bucket === 'covered' ? result.hasMoreCovered : result.hasMoreOpen,
      sort: parsed.data.sort || 'top',
      bucket: parsed.data.bucket || 'open',
      query: parsed.data.query || '',
      offset: parsed.data.offset || 0,
      limit: pageSize
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Unable to load suggestions.', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest('Please provide your full name, where you are from, a topic type, title, description, and a valid email.');
    }

    const spamTrap = `${parsed.data.website || ''}`.trim();
    if (spamTrap) return ok({ ok: true });

    const ip = getClientIp(request.headers);
    const userAgent = request.headers.get('user-agent') || '';
    const title = normalizeFreakyText(parsed.data.title);
    const description = normalizeFreakyText(parsed.data.description);

    const rate = await enforceRateLimit({
      action: 'freaky_submit',
      ip,
      email: parsed.data.email,
      max: 12,
      windowDays: 1
    });

    if (!rate.ok) {
      return badRequest('Too many suggestion attempts from this connection today. Please try again later.', 429);
    }

    const identity = await getOrCreateFreakyIdentity(parsed.data.email);
    if (identity.is_blocked) {
      return badRequest('This identity is currently blocked from submitting suggestions.', 403);
    }

    const selectedTopic = await getActiveFreakyTopicById(parsed.data.topicTermId);
    if (!selectedTopic) {
      return badRequest('Please choose a valid active Topic from the list.');
    }

    const suggestion = await createPendingFreakySuggestion({
      identityId: identity.id,
      submittedName: parsed.data.fullName,
      submittedFullName: parsed.data.fullName,
      submittedCountry: parsed.data.country,
      topicTermId: selectedTopic.id,
      topicSlug: selectedTopic.slug,
      topicName: selectedTopic.name,
      title,
      description
    });

    const tokenResult = await createFreakyVerificationToken({
      purpose: 'publish_suggestion',
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
      purpose: 'publish_suggestion',
      suggestionTitle: suggestion.title,
      requestId: tokenResult.token.id
    });

    const duplicates = await findSimilarFreakySuggestions(title, 5);

    await trackMixpanelServer('Suggestion Submit Requested', {
      source: 'freaky_register',
      suggestionId: suggestion.id
    });
    await trackMixpanelServer('Suggestion Verification Sent', {
      source: 'freaky_register',
      purpose: 'publish_suggestion',
      requestId: tokenResult.token.id,
      suggestionId: suggestion.id
    });

    return ok({
      ok: true,
      verificationRequired: true,
      purpose: 'publish_suggestion',
      requestId: tokenResult.token.id,
      suggestionId: suggestion.id,
      message: 'You’re one step away — we’ve sent you an email. Click the link to confirm your suggestion.',
      duplicates
    });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Unable to submit suggestion.', 500);
  }
}
