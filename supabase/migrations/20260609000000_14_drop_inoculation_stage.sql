-- 14_drop_inoculation_stage: the batch lifecycle no longer has a separate
-- "inoculation" stage. Creating a batch is the inoculation event (the
-- inoculated_on date still records when); a batch begins life in
-- "colonization". This migrates the default and any existing rows.

alter table public.batches alter column stage set default 'colonization';

-- Promote any batch still sitting in the legacy first stage. colonized_on is
-- backfilled from inoculated_on when it isn't already set, so elapsed-in-stage
-- math stays sensible.
update public.batches
   set stage = 'colonization',
       colonized_on = coalesce(colonized_on, inoculated_on)
 where stage = 'inoculation';
