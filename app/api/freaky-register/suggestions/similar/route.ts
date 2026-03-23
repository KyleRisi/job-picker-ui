import { NextRequest } from 'next/server';
import { z } from 'zod';
import { badRequest, ok } from '@/lib/server';
import { findSimilarFreakySuggestions } from '@/lib/freaky';

const schema = z.object({
  title: z.string().min(1).max(140),
  limit: z.coerce.number().int().min(1).max(8).optional()
});

export async function GET(request: NextRequest) {
  const parsed = schema.safeParse({
    title: request.nextUrl.searchParams.get('title') || '',
    limit: request.nextUrl.searchParams.get('limit') || undefined
  });

  if (!parsed.success) return badRequest('Invalid duplicate-check query.');

  try {
    const items = await findSimilarFreakySuggestions(parsed.data.title, parsed.data.limit || 5);
    return ok({ items });
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : 'Unable to check duplicates.', 500);
  }
}
