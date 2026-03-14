# Google Search Console Local Tool

Local Node.js CLI for authenticating with Google and inspecting Search Console data.

This tool is isolated from the website runtime and lives entirely under `tools/google-search-console/`.

## What this v1 tool does

- Authenticate via OAuth 2.0 installed-app flow
- List Search Console properties available to your account
- Query Search Analytics for a property + date range
- Produce a plain-English site readiness snapshot based on fetched data:
  - recent performance summary
  - top queries
  - top pages
  - device split
  - submitted sitemap summary (if available)

It does **not** implement full indexing diagnostics in this version.

## Required scope

This tool requests only:

- `https://www.googleapis.com/auth/webmasters.readonly`

## Prerequisites

- Node.js 18+
- A Google Cloud OAuth Client ID for **Desktop app**
- Access to at least one Search Console property

## Google OAuth setup (one-time)

1. In Google Cloud Console, create/select a project.
2. Enable the **Google Search Console API**.
3. Configure OAuth consent screen (External/Internal as needed).
4. Create credentials: **OAuth client ID** -> **Desktop app**.
5. Copy the generated:
   - Client ID
   - Client Secret

## Local environment file

Copy the example env file and paste your Google credentials:

```bash
cp tools/google-search-console/.env.example tools/google-search-console/.env.local
```

Open `tools/google-search-console/.env.local` and set:

```dotenv
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
```

Do not commit this file. It is gitignored.

## First Run (Exact Order)

Run these commands in this exact sequence from the workspace root in VS Code terminal:

```bash
npm install
npm run gsc:install
cp tools/google-search-console/.env.example tools/google-search-console/.env.local
```

Edit `tools/google-search-console/.env.local` and paste your `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then continue:

```bash
npm run gsc -- authenticate
npm run gsc -- list-properties
```

Pick one property from the list and run:

```bash
npm run gsc -- query-search-analytics --property "sc-domain:thecompendiumpodcast.com" --start-date 2026-02-01 --end-date 2026-02-29
npm run gsc -- inspect-site-readiness --property "sc-domain:thecompendiumpodcast.com"
```

Use the property value exactly as shown by `list-properties` (for example `sc-domain:...` or `https://.../`).

## Commands

### 1) authenticate

```bash
npm run gsc -- authenticate
```

What happens:

- The tool opens your browser to Google consent.
- If browser open fails, it prints a URL to copy manually.
- It waits for callback and stores token locally.
- If callback fails/times out, it asks you to paste the authorization `code`.

Token storage path:

- `~/.config/compendium-search-console/gsc-token.json`

This token file is local-only and outside the repo.

### 2) list-properties

```bash
npm run gsc -- list-properties
```

Lists site URL and permission level for each property your account can access.

### 3) query-search-analytics

```bash
npm run gsc -- query-search-analytics --property "sc-domain:example.com" --start-date YYYY-MM-DD --end-date YYYY-MM-DD
```

Optional flags:

- `--dimensions query,page,country,device,date`
- `--row-limit 25` (1 to 25000)

Example:

```bash
npm run gsc -- query-search-analytics --property "https://www.thecompendiumpodcast.com/" --start-date 2026-02-01 --end-date 2026-02-29 --dimensions query --row-limit 20
```

### 4) inspect-site-readiness

```bash
npm run gsc -- inspect-site-readiness --property "https://www.thecompendiumpodcast.com/"
```

Outputs a plain-English, decision-oriented snapshot based on fetched Search Console data only.

## Error handling notes

- Missing env vars: tells you to update `tools/google-search-console/.env.local`.
- No token: tells you to run `authenticate` first.
- Expired/invalid token: rerun `authenticate`.
- Invalid date format: requires `YYYY-MM-DD`.
- API permission issues: returns Google API error details.

## Security notes

- No secrets are hardcoded in source.
- OAuth credentials are read from local env.
- Token file is stored with restrictive local permissions.
- Keep `tools/google-search-console/.env.local` private.
