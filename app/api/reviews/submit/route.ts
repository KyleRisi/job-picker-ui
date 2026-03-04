import { NextRequest, NextResponse } from 'next/server';
import { createWebsiteReview } from '@/lib/reviews';
import { sendNewReviewNotificationEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    /* ─── Validate ─── */
    const name = (data.name || '').trim();
    const email = (data.email || '').trim();
    const title = (data.title || '').trim();
    const body = (data.body || '').trim();
    const rating = Number(data.rating);
    const country = (data.country || '').trim();

    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Name is required (at least 2 characters).' }, { status: 400 });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 });
    }
    if (!title || title.length < 2) {
      return NextResponse.json({ error: 'Review title is required.' }, { status: 400 });
    }
    if (!body || body.length < 5) {
      return NextResponse.json({ error: 'Review body is required (at least 5 characters).' }, { status: 400 });
    }
    if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5.' }, { status: 400 });
    }
    if (title.length > 100) {
      return NextResponse.json({ error: 'Title must be 100 characters or fewer.' }, { status: 400 });
    }
    if (body.length > 2000) {
      return NextResponse.json({ error: 'Review must be 2000 characters or fewer.' }, { status: 400 });
    }

    /* ─── Build review object ─── */
    const created = await createWebsiteReview({
      title,
      body,
      rating,
      author: name,
      country
    });

    try {
      await sendNewReviewNotificationEmail({
        reviewerName: name,
        reviewerEmail: email,
        title: created.title,
        body: created.body,
        rating: created.rating,
        country: created.country,
        source: 'website'
      });
    } catch (emailError) {
      console.error('Review notification email failed:', emailError);
    }

    return NextResponse.json({
      ok: true,
      message: 'Review submitted and pending admin approval.'
    });
  } catch (err) {
    console.error('Review submission error:', err);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
