# Redirect Policy Note (Freeze Baseline)

Date: 2026-03-18
Scope: taxonomy cleanup closeout and redirect model maintenance

## Ownership Model

1. redirects_table
- Manual redirects and explicit table-backed rows live in Supabase redirects table.
- These are the editable operational layer in admin, except rows marked read-only by policy.

2. taxonomy_policy
- Redirect and gone rules generated from taxonomy route policy are source-of-truth driven.
- They are system-generated and not edited directly in redirect table workflow.

3. middleware_deterministic
- Deterministic path-family patterns are runtime-owned and not table-backed.
- Includes legacy episode canonicalization families.

4. edge_canonical
- Canonical host/protocol enforcement is edge/domain owned and not table-backed.

## Podcast Legacy Family Policy

Family: /podcast/the-compendium-of-fascinating-things/episode/:slug

Policy: current-mirror-only
- Verification expects deleted legacy sources in this family to resolve to a current /episodes/<slug> URL with a successful final response.
- Verification does not require strict parity with every historical pre-cleanup target variant.
- Historical slug variants are not restored by default.

## Manual Exceptions

- Manual exceptions remain the mechanism for explicit one-off preservation requirements.
- Exceptions should be documented as concrete source path rows and justified in change notes.
- Any future historical variant retention should be explicit exception policy, not inferred from old snapshots.

## Freeze Rule

- After this baseline, avoid cleanup deletes/restores without a new approved change window.
- Runtime redirect execution remains unchanged in this closeout; only verification/reporting interpretation was aligned to policy.
