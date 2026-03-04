import { NextRequest } from 'next/server';
import { z } from 'zod';
import { badRequest, ok } from '@/lib/server';
import { enforceRateLimit } from '@/lib/rate-limit';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { getClientIp, normalizeEmail } from '@/lib/utils';
import { sendContactSubmissionNotificationEmail } from '@/lib/email';

const schema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(320),
  reason: z.enum(['general', 'guest', 'press', 'sponsorship', 'other']),
  subject: z.string().min(2).max(140),
  message: z.string().min(10).max(5000),
  website: z.string().max(200).optional()
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const parsed = schema.safeParse(rawBody);
    if (!parsed.success) {
      return badRequest('Please complete name, email, subject, and message.');
    }

    const input = parsed.data;
    const spamTrap = `${input.website || ''}`.trim();
    if (spamTrap) {
      return ok({ ok: true });
    }

    const name = input.name.trim();
    const email = normalizeEmail(input.email);
    const reason = input.reason;
    const subject = input.subject.trim();
    const message = input.message.trim();
    const ip = getClientIp(request.headers);

    const rate = await enforceRateLimit({
      action: 'contact_submission',
      ip,
      email,
      max: 8,
      windowDays: 1
    });
    if (!rate.ok) {
      return badRequest('Too many contact messages from this connection today. Please try again tomorrow.', 429);
    }

    const userAgent = request.headers.get('user-agent') || '';

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('contact_submissions')
      .insert({
        name,
        email,
        reason,
        subject,
        message,
        ip_address: ip,
        user_agent: userAgent
      })
      .select('id')
      .single();

    if (error || !data) {
      return badRequest(error?.message || 'Unable to save your message right now.', 500);
    }

    await sendContactSubmissionNotificationEmail({
      id: data.id,
      name,
      email,
      reason,
      subject,
      message,
      ip,
      userAgent
    });

    return ok({ ok: true, message: 'Message sent.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error.';
    return badRequest(message, 500);
  }
}
