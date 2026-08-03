-- 25_collapse_flush_rows_into_tubs
--
-- The Master Reference sheet has one Grow Cycle row per *flush*, and the
-- importer turned each of those into its own batch. But a batch is a physical
-- container: tub T-01 became three rows, T-02 four, T-08 three — 10 rows for 3
-- tubs — which is what made the batches board look full of duplicates. Every
-- other tub is a single "<tub>-F1" row wearing a flush suffix it never needed.
--
-- The per-flush detail already has a proper home: harvests carry flush_number.
-- So this collapses each container down to one batch and moves its flushes'
-- harvests onto it.
--
-- backend/app/sheet/parse.py now groups the sheet's flush rows by tub and emits
-- lot_code = "<tub>". That rename is why the second step below matters just as
-- much as the merge: if the existing rows kept their "-F1" codes, the next sync
-- would not match them and would insert a fresh duplicate for every tub.
-- Harvest source_ref stays "<tub>-F<n>", so harvest re-imports still merge.

begin;

-- Flush rows are exactly those whose lot_code is their own container id plus a
-- flush suffix. Rows like JMF-2531 or BO-01 don't match and are left alone.
create temp table _flush_rows as
select b.id,
       b.container_id,
       b.lot_code,
       ((regexp_match(b.lot_code, '^(.*)-F(\d+)$'))[2])::int as flush_no
  from public.batches b
 where b.lot_code ~ '^.+-F\d+$'
   and b.container_id <> ''
   and (regexp_match(b.lot_code, '^(.*)-F(\d+)$'))[1] = b.container_id;

create temp table _tub_survivor as
select container_id,
       (array_agg(id order by flush_no, id))[1] as survivor_id
  from _flush_rows
 group by container_id;

-- 1. Fold every non-survivor's facts into the tub's surviving row. Stage takes
--    the furthest point reached; milestones take the earliest date recorded
--    (spent_on the latest); numbers take the largest non-zero.
with agg as (
  select s.survivor_id,
         max(array_position(
           array['colonization','spawn_to_bulk','fruiting','harvesting','spent'], b.stage)) as stage_rank,
         min(b.inoculated_on) as inoculated_on,
         min(b.colonized_on)  as colonized_on,
         min(b.fruiting_on)   as fruiting_on,
         min(b.transferred_on) as transferred_on,
         min(b.first_pins_on) as first_pins_on,
         max(b.spent_on)      as spent_on,
         bool_or(b.contamination_flag) as contamination_flag,
         max(b.block_count)   as block_count,
         max(b.substrate_weight_kg) as substrate_weight_kg,
         max(b.rating)        as rating,
         min(b.room_id)       as room_id,
         string_agg(distinct nullif(b.issues,''), ' || ') as issues,
         string_agg(distinct nullif(b.notes,''),  ' || ') as notes
    from _tub_survivor s
    join _flush_rows f on f.container_id = s.container_id
    join public.batches b on b.id = f.id
   group by s.survivor_id
)
update public.batches t
   set stage               = coalesce(
                               (array['colonization','spawn_to_bulk','fruiting','harvesting','spent'])[a.stage_rank],
                               t.stage),
       inoculated_on       = coalesce(a.inoculated_on, t.inoculated_on),
       colonized_on        = coalesce(a.colonized_on, t.colonized_on),
       fruiting_on         = coalesce(a.fruiting_on, t.fruiting_on),
       transferred_on      = coalesce(a.transferred_on, t.transferred_on),
       first_pins_on       = coalesce(a.first_pins_on, t.first_pins_on),
       spent_on            = coalesce(a.spent_on, t.spent_on),
       contamination_flag  = a.contamination_flag,
       block_count         = greatest(t.block_count, coalesce(a.block_count, 0)),
       substrate_weight_kg = greatest(t.substrate_weight_kg, coalesce(a.substrate_weight_kg, 0)),
       rating              = coalesce(t.rating, a.rating),
       room_id             = coalesce(t.room_id, a.room_id),
       issues              = coalesce(a.issues, t.issues),
       notes               = coalesce(a.notes, t.notes)
  from agg a
 where t.id = a.survivor_id;

-- 2. Move every child record off the rows about to go. Harvests keep their own
--    flush_number, so the per-flush history survives intact on the tub.
update public.harvests h set batch_id = s.survivor_id
  from _flush_rows f join _tub_survivor s on s.container_id = f.container_id
 where h.batch_id = f.id and f.id <> s.survivor_id;

update public.tasks t set batch_id = s.survivor_id
  from _flush_rows f join _tub_survivor s on s.container_id = f.container_id
 where t.batch_id = f.id and f.id <> s.survivor_id;

update public.contamination_logs c set batch_id = s.survivor_id
  from _flush_rows f join _tub_survivor s on s.container_id = f.container_id
 where c.batch_id = f.id and f.id <> s.survivor_id;

update public.stage_events e set batch_id = s.survivor_id
  from _flush_rows f join _tub_survivor s on s.container_id = f.container_id
 where e.batch_id = f.id and f.id <> s.survivor_id;

update public.batch_materials m set batch_id = s.survivor_id
  from _flush_rows f join _tub_survivor s on s.container_id = f.container_id
 where m.batch_id = f.id and f.id <> s.survivor_id;

update public.issue_log i set batch_id = s.survivor_id
  from _flush_rows f join _tub_survivor s on s.container_id = f.container_id
 where i.batch_id = f.id and f.id <> s.survivor_id;

-- 3. Nothing may still reference a row we're about to delete. harvests,
--    contamination_logs, stage_events and batch_materials all cascade, so an
--    unmoved child would vanish silently rather than error — check explicitly.
do $$
declare stragglers int;
begin
  select count(*) into stragglers
    from _flush_rows f
    join _tub_survivor s on s.container_id = f.container_id
   where f.id <> s.survivor_id
     and (exists (select 1 from public.harvests            x where x.batch_id = f.id)
       or exists (select 1 from public.tasks               x where x.batch_id = f.id)
       or exists (select 1 from public.contamination_logs  x where x.batch_id = f.id)
       or exists (select 1 from public.stage_events        x where x.batch_id = f.id)
       or exists (select 1 from public.batch_materials     x where x.batch_id = f.id));
  if stragglers > 0 then
    raise exception 'Aborting: % duplicate row(s) still own child records', stragglers;
  end if;
end $$;

delete from public.batches b
 using _flush_rows f join _tub_survivor s on s.container_id = f.container_id
 where b.id = f.id and f.id <> s.survivor_id;

-- 4. Drop the flush suffix so the lot code is the container, which is what the
--    importer now upserts on. Done last, once each container has exactly one row.
update public.batches b
   set lot_code = b.container_id
  from _tub_survivor s
 where b.id = s.survivor_id and b.lot_code <> b.container_id;

drop table _flush_rows;
drop table _tub_survivor;

commit;
