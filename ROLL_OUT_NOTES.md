# Workspace Taxonomy + Blog Editor Rollout Notes

## Scope
This checkpoint includes:
- Workspace Taxonomies table (shared `discovery_terms`) with:
  - `New`, `Edit`, `Archive`, `Reactivate on save`
  - Search clear `x`, status/type filters
  - Resizable + persistent columns
  - Fixed `Actions` column
  - Added assignment count columns:
    - `Blogs Assigned`
    - `Episodes Assigned`
- Workspace blog editor taxonomy wiring to shared taxonomy model (`discovery_terms`) for:
  - Primary category/topic (single)
  - Topics (max 3)
  - Themes (max 3)
  - Collections (max 2)
  - Series (max 1)
- Archive workflow foundations:
  - Soft archive fields on taxonomy tables
  - Redirect support including `410`
  - Taxonomy archive audit table

## Do Not Do Yet
- Do **not** run migration `supabase/migrations/0025_taxonomy_archive_and_redirect_410.sql` on production until final pre-deploy test pass.
- Do **not** perform taxonomy archive/redirect experiments on a shared prod/dev DB.

## Required Environment / Runtime
- Admin API auth/session must be working for workspace/admin routes.
- Redirect resolution path/middleware must be enabled in deploy runtime.
- If used in your environment: `REDIRECT_RESOLVE_SECRET` must be set where redirect resolve endpoint depends on it.

## DB Migration Order (When Ready)
1. Backup snapshot.
2. Run `0025_taxonomy_archive_and_redirect_410.sql`.
3. Validate schema:
   - Added `is_active`, `archived_at`, `archive_mode`, `redirect_target` columns
   - Redirect `status_code` check includes `410`
   - `redirects.target_url` nullable
   - `taxonomy_archive_events` exists and indexed
4. Validate API CRUD after migration.

## Smoke Test Plan (Pre-Deploy / Staging)
1. Workspace Taxonomies page
   - Loads rows
   - `Edit columns` persists after refresh
   - `Actions` column always visible and fixed
   - Search clear `x` works
2. Create / Edit taxonomy
   - Slug auto-generates and can be edited
   - Category/type can be edited
3. Archive / Reactivate
   - Archive sets row to archived
   - Edit archived row with `Reactivate taxonomy on save` returns row to active
4. Count columns
   - `Blogs Assigned` and `Episodes Assigned` display non-negative counts
5. Workspace blog editor taxonomy panel
   - Can select primary category/topic and limited multi-select values
   - Save + refresh preserves selections
6. Preview/public checks
   - No runtime errors for edited posts

## Production Rollout Checklist
1. Freeze admin taxonomy edits during deploy window.
2. Deploy app code.
3. Run migration(s) once on production.
4. Run smoke tests immediately.
5. Re-enable edits after verification.

## Rollback Strategy
- App rollback:
  - Revert to previous deploy artifact/commit.
- DB rollback:
  - Prefer restore from pre-migration backup if full rollback required.
  - If partial:
    - Leave added columns/tables in place (non-breaking additive changes)
    - Disable new UI paths by reverting app code
    - Revert any newly created redirect rows from archive actions if needed

## Known Risks / Watch Items
- Shared prod/dev database can cause accidental live data mutation during testing.
- Archive+redirect behavior depends on runtime redirect execution path; verify in deployed environment.
- Slug/URL ownership conflicts should be checked before reactivation or slug reuse.

## Suggested Git Workflow
1. Keep this work on a dedicated feature branch.
2. Use one checkpoint commit now.
3. Create a final pre-deploy hardening commit after staging validation.
