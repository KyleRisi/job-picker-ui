# Compendium Circus HR

Whimsical HR portal prototype for The Compendium podcast.

## Stack

- Next.js 14 App Router + TypeScript + TailwindCSS
- Supabase (Postgres + Auth)
- Resend for transactional email
- Netlify deployment (`@netlify/plugin-nextjs`)
- Server-only operations via Next route handlers (deployed as Netlify Functions)

## Features implemented

- Landing page (`/`) with required heading/subtitle/CTAs
- Public jobs browser (`/jobs`) with tabs:
  - Available positions (AVAILABLE + REHIRING)
  - Filled positions (title + first name only, controlled by admin toggle)
- Job detail page (`/jobs/[id]`)
- Public application form (`/apply/[id]`) with required fields/questions
- Atomic job claiming with strict DB locking (`claim_job_atomic` RPC)
- One active job per email enforced in DB + API
- Application confirmation email with assignment reference + submitted content + manage link
- My Job flow:
  - `/my-job` magic-link request using email + assignment reference
  - `/my-job/recover` reference recovery by email (email-only reveal)
  - `/my-job/file` authenticated HR file view/edit
- Locked application answers after apply; editable day-to-day/incidents/KPI + name updates
- Email change flow with explicit confirmation link to new email before update
- Resignation flow with 3 exit questions; records exit interview; marks job `REHIRING`; deactivates + scrubs live assignment
- Archive retention table (`applications_archive`) updated on editable profile updates
- Admin auth by `ADMIN_EMAIL` magic link
- Admin dashboard (`/admin`) with counts + recent applications/resignations
- Admin jobs management (`/admin/jobs`) with create/edit/delete + bulk CSV upload + CSV template download
- Admin exports (`/admin/exports`) for active roles, application archive, exit interviews
- Public listener reviews page (`/reviews`) backed by DB with fallback JSON data
- Review submission API (`/api/reviews/submit`) with admin moderation workflow
- Admin reviews management (`/admin/reviews`) with filters + bulk hide/unhide + detail view
- Database-driven redirects with runtime middleware 301/302/307/308 handling
- Admin redirects management (`/admin/redirects`) with create/edit/search + CSV import/export
- Admin settings (`/admin/settings`) for:
  - show/hide filled first names publicly
  - disable new sign-ups (blocks magic links for brand-new auth users)
- Server-side rate limiting table (`rate_limits`) for:
  - magic link requests: 5/hour per IP and email
  - recovery emails: 3/hour per IP and email
  - applications: 10/day per IP

## Environment

Copy `.env.example` to `.env.local` and fill:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
FROM_EMAIL=
ADMIN_EMAIL=
APP_BASE_URL=http://localhost:3000
STRIPE_SECRET_KEY=
STRIPE_KEYCHAIN_PRICE_ID=
STRIPE_PAYMENT_LINK_URL=
STRIPE_WEBHOOK_SECRET=
```

`STRIPE_PAYMENT_LINK_URL` is optional. If set, merch "Buy Now" redirects to that Stripe Payment Link instead of creating a Checkout Session with `STRIPE_SECRET_KEY` + `STRIPE_KEYCHAIN_PRICE_ID`.

## Database setup (Supabase)

1. Open Supabase SQL editor.
2. Run migrations in order:
  - `supabase/migrations/0001_init.sql`
  - `supabase/migrations/0002_fix_claim_job_ref_generation.sql`
  - `supabase/migrations/0003_clean_malformed_description_chars.sql`
  - `supabase/migrations/0004_add_salary_benefits_to_jobs.sql`
  - `supabase/migrations/0005_add_broadcast_fields_to_applications_archive.sql`
  - `supabase/migrations/0006_add_profile_photo_to_assignments_and_archive.sql`
  - `supabase/migrations/0007_add_rehiring_reason_to_jobs.sql`
  - `supabase/migrations/0008_create_reviews_table.sql`
  - `supabase/migrations/0009_create_redirects_table.sql`
3. Run `supabase/seed.sql`.

This creates all required tables:
- `jobs`
- `assignments`
- `applications_archive`
- `exit_interviews`
- `settings`
- `rate_limits`
- plus `email_change_requests` for confirmed email updates

And inserts 30 seeded circus roles (`JOB-0001` to `JOB-0030`).

## Local development

```bash
npm install
npm run netlify:dev
```

App runs at `http://localhost:3000`.

Notes:
- Server-only keys (`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`) are used only in route handlers.
- Route handlers under `app/api/*` are Netlify Functions when deployed.

## Netlify deploy

1. Push this repo to GitHub.
2. Create Netlify site from the repo.
3. Set environment variables in Netlify UI (same as `.env.example`).
4. Build command: `npm run build` (already in `netlify.toml`).
5. Plugin `@netlify/plugin-nextjs` is configured in `netlify.toml`.
6. After each production deploy, run chunk integrity check:
   - `npm run deploy:integrity`
   - Optional target override:
     - `npm run deploy:integrity -- https://main--compendium-circus-hr.netlify.app/`
     - `DEPLOY_URL=https://www.thecompendiumpodcast.com npm run deploy:integrity`

This check fetches the homepage HTML, extracts `/_next/static/chunks/*.js` references, and fails if any chunk `HEAD` request is non-`200`.

## Resend domain verification (required custom sender domain)

1. In Resend dashboard, add your domain (example: `mail.example.com`).
2. Add DNS records shown by Resend (SPF/DKIM + verification).
3. Wait until domain is verified.
4. Set `FROM_EMAIL` to an address on that domain (example: `hr@mail.example.com`).
5. Confirm emails send from `Compendium Circus HR <FROM_EMAIL>`.

## Admin configuration

- Set `ADMIN_EMAIL` to the single admin account.
- Visit `/admin` and request a magic link with that exact email.
- Manage public visibility and signup pause in `/admin/settings`.

## Important security and behavior notes

- Public users never get service-role access.
- Job claim + resignation are transactional SQL RPC operations.
- Public pages render plain text only (no unsanitized HTML rendering).
- Filled positions expose first name only (optionally hidden by setting).

## Route index

- `/`
- `/jobs`
- `/jobs/[id]`
- `/apply/[id]`
- `/my-job`
- `/my-job/recover`
- `/my-job/file`
- `/admin`
- `/admin/reviews`
- `/admin/reviews/[id]`
- `/admin/redirects`
- `/admin/jobs`
- `/admin/exports`
- `/admin/settings`
- `/reviews`
