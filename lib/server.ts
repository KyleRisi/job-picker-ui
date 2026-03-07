import { NextResponse } from 'next/server';

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function getErrorMessage(error: unknown, fallback = 'Something went wrong.') {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim().length) {
      return message;
    }
  }
  return fallback;
}
