# Freaky Register Import Runbook

## Files

- Suggestions template: `docs/templates/freaky-suggestions-import-template.csv`
- Votes template: `docs/templates/freaky-votes-import-template.csv`
- Import SQL: `scripts/freaky-register-import.sql`

## Import order

1. Fill your CSV files using the templates.
2. Open Supabase SQL editor and run `scripts/freaky-register-import.sql` once.
: This creates staging + mapping tables if they do not exist.
3. In Supabase Table Editor, import your suggestions CSV into `freaky_import_suggestions_staging`.
4. Optional: import votes CSV into `freaky_import_votes_staging`.
5. Run `scripts/freaky-register-import.sql` again.
: This will create identities, insert suggestions, resolve duplicates, insert votes, and recalculate `upvote_count`.

## Notes

- `external_key` is required and must be unique per suggestion.
- `status` allowed values:
  - `pending_verification`
  - `published`
  - `hidden`
  - `spam`
  - `removed`
  - `duplicate`
  - `expired_unverified`
- Topic resolution order during import:
  1. `topic_term_id`
  2. `topic_slug`
  3. `topic_name`
- Only active topic terms are linked (`discovery_terms.term_type = 'topic'` and `is_active = true`).
- `submitted_name` is automatically set to `submitted_full_name`.

## Optional cleanup after import

If you want to clear staging tables before the next import batch:

```sql
truncate table freaky_import_votes_staging;
truncate table freaky_import_suggestions_staging;
```

## Quick verification queries

```sql
select count(*) as imported_suggestions
from freaky_suggestions
where id in (select suggestion_id from freaky_import_suggestion_map);

select count(*) as imported_votes
from freaky_votes
where suggestion_id in (select suggestion_id from freaky_import_suggestion_map);

select status, count(*)
from freaky_suggestions
where id in (select suggestion_id from freaky_import_suggestion_map)
group by status
order by count(*) desc;
```
