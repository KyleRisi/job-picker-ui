import { NextResponse } from 'next/server';

export function badRequest(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
