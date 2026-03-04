import { NextRequest, NextResponse } from 'next/server';
import { clearAdminSessionCookie } from '@/lib/admin-session';

export async function POST(_req: NextRequest) {
  const response = NextResponse.json({ message: 'Signed out.' });
  clearAdminSessionCookie(response);
  return response;
}

