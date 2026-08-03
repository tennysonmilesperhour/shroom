-- 23_normalize_retired_inoculation_stage
--
-- Migration 14 (14_drop_inoculation_stage) retired the "inoculation" stage: a
-- batch's creation *is* the inoculation event, so the lifecycle now begins at
-- "colonization". The sheet importer kept emitting the old value afterwards,
-- so re-imported tubs landed back on a stage the app's kanban board has no
-- column for — the board silently dropped them, and every stage rollup
-- disagreed with the batch list.
--
-- The importer now writes "colonization" (backend/app/sheet/parse.py); this
-- normalizes the rows that were already re-introduced. Same shape as migration
-- 14: colonized_on is backfilled from inoculated_on when it isn't already set
-- so elapsed-in-stage math stays sensible.

update public.batches
   set stage = 'colonization',
       colonized_on = coalesce(colonized_on, inoculated_on)
 where stage = 'inoculation';
