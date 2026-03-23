import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

export const FREAKY_IDENTITY_COOKIE = 'freaky_identity_session';
const FREAKY_IDENTITY_TTL_SECONDS = 60 * 60 * 24 * 90;

function sessionSecret(): string {
  return process.env.FREAKY_IDENTITY_SESSION_SECRET || env.adminSessionSecret || env.supabaseServiceRoleKey || 'freaky-identity-secret';
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload: string): string {
  return createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function createFreakyIdentitySessionToken(identityId: string): string {
  const expiresAt = Date.now() + FREAKY_IDENTITY_TTL_SECONDS * 1000;
  const payload = `${identityId}|${expiresAt}`;
  const encodedPayload = base64UrlEncode(payload);
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyFreakyIdentitySessionToken(token: string): string | null {
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expected = signPayload(encodedPayload);
  if (!safeEqual(signature, expected)) return null;

  let payload = '';
  try {
    payload = base64UrlDecode(encodedPayload);
  } catch {
    return null;
  }

  const [identityId, expiresAtRaw] = payload.split('|');
  const expiresAt = Number(expiresAtRaw || '0');
  if (!identityId || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
  return identityId;
}

export function getFreakyIdentityIdFromRequest(request: NextRequest): string | null {
  const token = request.cookies.get(FREAKY_IDENTITY_COOKIE)?.value || '';
  if (!token) return null;
  return verifyFreakyIdentitySessionToken(token);
}

export function setFreakyIdentityCookie(response: NextResponse, token: string) {
  response.cookies.set(FREAKY_IDENTITY_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: FREAKY_IDENTITY_TTL_SECONDS
  });
}

export function clearFreakyIdentityCookie(response: NextResponse) {
  response.cookies.set(FREAKY_IDENTITY_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  });
}
