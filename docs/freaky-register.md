# Freaky Register

## Overview

Freaky Register is a public suggestion board at `/freaky-register` for episode topic ideas.

Core behavior:
- Public browsing/searching without sign-in.
- New suggestions require email verification before becoming visible.
- Upvotes are one-per-verified-identity per suggestion.
- Page is intentionally non-indexable (`noindex`, `nofollow`) and excluded from sitemap.

## Data model

Migrations:
- `supabase/migrations/0030_create_freaky_register.sql`
- `supabase/migrations/0031_freaky_suggestion_submitter_fields.sql`

Tables:
- `freaky_identities`: verified email identities, block status.
- `freaky_suggestions`: suggestion content + moderation/public visibility state, plus submitter metadata:
  - `submitted_name`
  - `submitted_full_name`
  - `submitted_country`
  - `topic_term_id`, `topic_slug`, `topic_name` (active Topic selected from `discovery_terms`)
- `freaky_votes`: one vote per `(suggestion_id, identity_id)`.
- `freaky_verification_tokens`: one-time verification links for publish/upvote flows.

Topic options:
- Endpoint: `GET /api/freaky-register/topics`
- Returns active `discovery_terms` where `term_type = 'topic'` and `is_active = true`.

Important statuses:
- `pending_verification`
- `published`
- `hidden`
- `spam`
- `removed`
- `duplicate`
- `expired_unverified`

## Verification flow

Suggestion submit:
1. User submits name, full name, location, topic type, title, description, and then email.
2. Suggestion is stored as `pending_verification` and hidden.
3. Verification email is sent with a one-time link (24h expiry).
4. On verify: identity is marked verified, suggestion becomes `published` + visible.

Upvote:
1. If verified identity session exists, vote is immediate.
2. Otherwise user is prompted for email and receives a verify link.
3. On verify: vote is cast (idempotent if already voted).

Verification route:
- `/freaky-register/verify?token=...&request=...`
- Redirects back to `/freaky-register` with clear state params (`suggestion_success`, `vote_success`, `expired`, `invalid`, `blocked`) and suggestion anchor when available.

Resend:
- Endpoint: `POST /api/freaky-register/verification/resend`
- Uses request context (`requestId`) from previous flow.
- Cooldown: 1 resend per 60s (identity + purpose), plus daily rate limit.

## Upvote abuse protection

- DB unique constraint on `freaky_votes (suggestion_id, identity_id)` prevents duplicate votes.
- Duplicate vote attempts return friendly idempotent response (`alreadyBacked: true`).
- Rate limiting + honeypot validation on submit/vote/resend endpoints.
- Blocked identities are denied across submit, vote, resend, and verify side-effects.

## Moderation controls

Workspace route:
- `/workspace/dashboard/freaky-register`

Actions:
- Suggestion: hide, unhide, spam, remove (soft), mark duplicate.
- Identity: block/unblock (with optional reason).

Admin APIs:
- `GET /api/admin/freaky-register`
- `PATCH /api/admin/freaky-register/[id]`
- `PATCH /api/admin/freaky-register/identities/[id]`

## Cleanup and maintenance

Daily Netlify function:
- `netlify/functions/freaky-register-cleanup-daily.mjs`
- Calls `POST /api/internal/freaky-register/cleanup` with `x-freaky-cleanup-secret`.

Cleanup behavior:
- Archive pending unverified suggestions older than 7 days (`expired_unverified`).
- Delete expired/consumed verification tokens beyond retention window.

Required env vars:
- `FREAKY_CLEANUP_SECRET`
- `FREAKY_IDENTITY_SESSION_SECRET` (recommended; falls back if unset)

## Copy and styling customization

Primary UI files:
- `app/(public)/freaky-register/page.tsx`
- `components/freaky-register-page.tsx`

Key backend files:
- `lib/freaky.ts`
- `lib/freaky-session.ts`
- `app/api/freaky-register/*`
- `app/(public)/freaky-register/verify/route.ts`

If you want to tweak voice/tone, edit the intro, banners, and helper copy in `components/freaky-register-page.tsx`.
