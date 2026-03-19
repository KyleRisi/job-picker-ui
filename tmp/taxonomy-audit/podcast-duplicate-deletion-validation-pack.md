# Podcast Duplicate Deletion Validation Pack (Preparation Only)

Scope: 90 rows from `podcast-manual-duplicates.csv`.

## Objective
Safely remove duplicate manual podcast episode redirects in a future release while preserving redirect outcomes.

## Preconditions
- Deterministic podcast pattern remains active and unchanged.
- No ownership migration in this phase.
- `podcast-manual-duplicates.csv` frozen and approved as source-of-truth candidate set.

## Pre-Deletion Checks (Must Pass)
1. Deterministic parity check: For each source in `podcast-manual-duplicates.csv`, compute expected `/episodes/<slug>` and verify it equals the current manual target.
2. Status parity check: Every candidate row is `301` and `match_type=exact`.
3. Conflict check: No higher-priority manual/system rule changes final destination for candidate sources.
4. Chain check: Sample at least top traffic + 100% of changed paths in staging; final URL and final status must match baseline.
5. Canonical/host check: Confirm host canonicalization behavior unchanged for candidate URLs.

## Rollback Plan
1. Keep immutable snapshot of candidate rows (full row payload, IDs) prior to deletion.
2. If regressions are detected, restore snapshot rows by ID/value in a single revert migration/job.
3. Re-run chain check suite and compare to pre-delete baseline.

## Success Criteria
1. For all candidate sources, final destination equals pre-delete baseline.
2. No increase in 4xx/5xx for candidate source paths.
3. No increase in redirect chain depth for candidate source paths.
4. No SEO/crawl anomalies attributable to candidate paths after release window.

## Evidence Required for Sign-Off
- Signed parity report for all 90 rows.
- Before/after chain test results for full candidate set.
- Snapshot + rollback artifact verified restorable.
- 24-72h post-release monitoring report (errors, chains, crawl observations).
