import fallbackReviewsData from '@/lib/reviews-data.json';
import { createSupabaseAdminClient } from '@/lib/supabase';

export type ReviewSource = 'apple' | 'website' | 'manual' | 'scraped';
export type ReviewStatus = 'visible' | 'hidden';

export type PublicReview = {
  id: string;
  title: string;
  body: string;
  rating: number;
  author: string;
  country: string;
  platform: 'apple' | 'website';
  date: string;
};

type ReviewRow = {
  id: string;
  title: string;
  body: string;
  rating: number;
  author: string;
  country: string;
  source: ReviewSource;
  status: ReviewStatus;
  received_at: string;
};

function toPlatform(source: ReviewSource): 'apple' | 'website' {
  return source === 'apple' ? 'apple' : 'website';
}

function toPublicReview(row: ReviewRow): PublicReview {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    rating: row.rating,
    author: row.author,
    country: row.country || '',
    platform: toPlatform(row.source),
    date: new Date(row.received_at).toISOString().slice(0, 10)
  };
}

function getFallbackPublicReviews(limit?: number): PublicReview[] {
  const rows = (fallbackReviewsData as PublicReview[])
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (typeof limit === 'number') return rows.slice(0, limit);
  return rows;
}

export async function getVisibleReviews(limit?: number): Promise<PublicReview[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('reviews')
    .select('id,title,body,rating,author,country,source,status,received_at')
    .eq('status', 'visible')
    .order('received_at', { ascending: false });

  if (typeof limit === 'number') {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error || !data?.length) {
    return getFallbackPublicReviews(limit);
  }

  return (data as ReviewRow[]).map(toPublicReview);
}

export async function getVisibleReviewsPage(
  page = 1,
  pageSize = 12
): Promise<{
  reviews: PublicReview[];
  pagination: { page: number; totalPages: number; total: number; pageSize: number };
}> {
  const normalizedPageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 12;
  const requestedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const total = await getVisibleReviewsCount();
  const totalPages = Math.max(1, Math.ceil(total / normalizedPageSize));
  const safePage = Math.min(requestedPage, totalPages);
  const from = (safePage - 1) * normalizedPageSize;
  const to = from + normalizedPageSize - 1;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('reviews')
    .select('id,title,body,rating,author,country,source,status,received_at')
    .eq('status', 'visible')
    .order('received_at', { ascending: false })
    .range(from, to);

  if (error || !data) {
    const fallbackRows = getFallbackPublicReviews();
    const fallbackTotal = fallbackRows.length;
    const fallbackTotalPages = Math.max(1, Math.ceil(fallbackTotal / normalizedPageSize));
    const fallbackSafePage = Math.min(requestedPage, fallbackTotalPages);
    const fallbackStart = (fallbackSafePage - 1) * normalizedPageSize;
    const fallbackReviews = fallbackRows.slice(fallbackStart, fallbackStart + normalizedPageSize);
    return {
      reviews: fallbackReviews,
      pagination: {
        page: fallbackSafePage,
        totalPages: fallbackTotalPages,
        total: fallbackTotal,
        pageSize: normalizedPageSize
      }
    };
  }

  return {
    reviews: (data as ReviewRow[]).map(toPublicReview),
    pagination: {
      page: safePage,
      totalPages,
      total,
      pageSize: normalizedPageSize
    }
  };
}

export async function getVisibleReviewsCount(): Promise<number> {
  const supabase = createSupabaseAdminClient();
  const { count, error } = await supabase
    .from('reviews')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'visible');

  if (error || typeof count !== 'number') {
    return getFallbackPublicReviews().length;
  }

  return count;
}

export async function createWebsiteReview(input: {
  title: string;
  body: string;
  rating: number;
  author: string;
  country: string;
}): Promise<PublicReview> {
  const supabase = createSupabaseAdminClient();
  const status: ReviewStatus = input.rating >= 3 ? 'visible' : 'hidden';

  const payload = {
    title: input.title,
    body: input.body,
    rating: input.rating,
    author: input.author,
    country: input.country,
    source: 'website' as const,
    status,
    received_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('reviews')
    .insert(payload)
    .select('id,title,body,rating,author,country,source,status,received_at')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save review.');
  }

  return toPublicReview(data as ReviewRow);
}

export type AdminReview = ReviewRow;

export async function getAllReviewsAdmin(): Promise<AdminReview[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('reviews')
    .select('id,title,body,rating,author,country,source,status,received_at')
    .order('received_at', { ascending: false });

  if (error) throw error;
  return (data || []) as AdminReview[];
}
