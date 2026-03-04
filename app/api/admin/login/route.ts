import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { env } from '@/lib/env';
import { normalizeEmail } from '@/lib/utils';
import { badRequest } from '@/lib/server';
import { createAdminSessionToken, setAdminSessionCookie } from '@/lib/admin-session';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return badRequest('Enter admin email and password.');

  if (!env.adminPassword) {
    return badRequest('ADMIN_PASSWORD is not configured on this environment.', 500);
  }

  const email = normalizeEmail(parsed.data.email);
  const password = `${parsed.data.password || ''}`;

  if (email !== env.adminEmail || password !== env.adminPassword) {
    return badRequest('Invalid admin email or password.', 401);
  }

  const token = createAdminSessionToken(email);
  const response = NextResponse.json({ message: 'Signed in.' });
  setAdminSessionCookie(response, token);
  return response;
}
