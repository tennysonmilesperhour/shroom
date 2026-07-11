-- 18_harvests_source_ref_uniq_fix: make the harvests upsert key inferrable.
--
-- Migration 15 created the harvests natural key as a PARTIAL unique index
-- (harvests_source_ref_uniq ... WHERE source_ref IS NOT NULL). Every other
-- importer target is a plain unique index, but this one is partial — and
-- Postgres cannot infer a partial index from a bare conflict target. The
-- importer's Supabase sink upserts with PostgREST `on_conflict=source_ref`
-- (equivalently, SQL `ON CONFLICT (source_ref)`), which therefore fails with
--   42P10: there is no unique or exclusion constraint matching the ON CONFLICT
-- specification
-- so the Harvest Tracker tab never syncs while the other 12 tables do.
--
-- Replace the partial index with a plain unique index. A plain unique index
-- still treats NULLs as distinct, so multiple rows with a NULL source_ref
-- remain allowed (the reason the predicate was added) — the behavior is
-- preserved, but the conflict target is now inferrable and harvests upserts
-- succeed. Existing non-null source_ref values are already unique, so the new
-- index builds cleanly.

drop index if exists public.harvests_source_ref_uniq;
create unique index if not exists harvests_source_ref_uniq
  on public.harvests (source_ref);
