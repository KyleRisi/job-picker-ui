# Homepage V2 Launch Readiness

## Launch Control Path

Homepage and preview logic are controlled in:

- `app/(public)/page.tsx`
- `lib/homepage-v2/env.ts`

Canonical `/` now serves the current homepage implementation directly.
Preview gating remains host-based on `/preview/homepage-v2`.

## Hardening Implemented

Canonical `/` is expected to be cacheable (ISR/static-capable) and should not rely on request-time homepage version toggles.

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
