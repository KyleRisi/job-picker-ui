# Homepage V2 Launch Readiness

## Launch Control Path

Homepage swap logic for `/` is controlled in:

- `app/(public)/page.tsx`
- `lib/homepage-v2/env.ts`

Runtime condition for serving homepage v2 at `/`:

- `HOMEPAGE_V2_LIVE=true`
- `HOMEPAGE_V2_GATE_PASSED=true`

If either is false, `/` serves homepage v1.

## Hardening Implemented

`app/(public)/page.tsx` now exports:

- `dynamic = 'force-dynamic'`

This prevents the root route from being statically frozen at build time and ensures launch flags are evaluated at request time.

## Required Pre-Launch Domain Normalization Checks

Run these checks against the real production environment before launch:

1. Apex to www:

```bash
curl -I https://thecompendiumpodcast.com/
```

Expected:

- `301`/`308` redirect to `https://www.thecompendiumpodcast.com/`

2. HTTP to HTTPS (canonical host):

```bash
curl -I http://www.thecompendiumpodcast.com/
```

Expected:

- `301`/`308` redirect to `https://www.thecompendiumpodcast.com/`

3. HTTP apex full normalization:

```bash
curl -I http://thecompendiumpodcast.com/
```

Expected:

- redirect chain resolves to `https://www.thecompendiumpodcast.com/`

4. Canonical homepage response:

```bash
curl -I https://www.thecompendiumpodcast.com/
```

Expected:

- `200 OK`
- no `x-robots-tag: noindex`

5. Canonical + robots in rendered head:

```bash
curl -s https://www.thecompendiumpodcast.com/ | rg -o '<link rel="canonical" href="[^"]+"|<meta name="robots" content="[^"]+"'
```

Expected:

- canonical is `https://www.thecompendiumpodcast.com`
- robots is `index, follow`

