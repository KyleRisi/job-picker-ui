import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import { AdminTabs } from '@/components/admin-tabs';
import { AdminReviewVisibilityForm } from '@/components/forms/admin-review-visibility-form';
import { env } from '@/lib/env';
import { createSupabaseAdminClient } from '@/lib/supabase';
import { isAdminSessionActive } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminReviewDetailPage({ params }: { params: { id: string } }) {
  noStore();

  if (!env.adminAuthDisabled && !isAdminSessionActive()) {
    redirect('/admin');
  }

  const admin = createSupabaseAdminClient();
  const { data: review } = await admin
    .from('reviews')
    .select('id,title,body,rating,author,country,source,status,received_at')
    .eq('id', params.id)
    .maybeSingle();

  if (!review) notFound();

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl font-black">Review</h1>
        <Link href="/admin/reviews" className="btn-secondary">
          Back to Reviews
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-[220px_1fr] md:items-start">
        <AdminTabs current="reviews" />

        <div className="space-y-4">
          <div className="card space-y-3">
            <p>
              <strong>Author:</strong> {review.author || 'Anonymous'}
            </p>
            <p>
              <strong>Received:</strong>{' '}
              {new Date(review.received_at).toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
              })}
            </p>
            <p>
              <strong>Rating:</strong> {review.rating}★
            </p>
            <p>
              <strong>Source:</strong> <span className="uppercase">{review.source}</span>
            </p>
            <p>
              <strong>Country:</strong> {review.country || 'N/A'}
            </p>
          </div>

          <div className="card space-y-3">
            <h2 className="text-2xl font-black">{review.title || '(No title)'}</h2>
            <p className="whitespace-pre-line leading-relaxed">{review.body}</p>
          </div>

          <div className="card">
            <AdminReviewVisibilityForm reviewId={review.id} initialStatus={review.status} />
          </div>
        </div>
      </div>
    </section>
  );
}
