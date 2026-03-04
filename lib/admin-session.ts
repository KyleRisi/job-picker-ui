import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { env } from './env';

export const ADMIN_SESSION_COOKIE = 'compendium_admin_session';
const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function getSessionSecret(): string {
  return env.adminSessionSecret || env.supabaseServiceRoleKey || 'compendium-admin-session-secret';
}

function signPayload(payload: string): string {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

export function createAdminSessionToken(email: string): string {
  const expiresAt = Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000;
  const payload = `${email.toLowerCase()}|${expiresAt}`;
  const encodedPayload = base64UrlEncode(payload);
  const signature = signPayload(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

export function verifyAdminSessionToken(token: string): string | null {
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

  const [email, expiresAtRaw] = payload.split('|');
  const expiresAt = Number(expiresAtRaw || '0');
  if (!email || !Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
  return email.toLowerCase();
}

export function getAdminEmailFromSessionCookie(): string | null {
  const token = cookies().get(ADMIN_SESSION_COOKIE)?.value || '';
  if (!token) return null;
  return verifyAdminSessionToken(token);
}

export function isAdminSessionActive(): boolean {
  const email = getAdminEmailFromSessionCookie();
  if (!email) return false;
  return email === env.adminEmail;
}

export function setAdminSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: ADMIN_SESSION_TTL_SECONDS
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: true,
    path: '/',
    maxAge: 0
  });
}

