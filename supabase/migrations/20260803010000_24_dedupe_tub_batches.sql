-- 24_dedupe_tub_batches
--
-- Tubs T-01 and T-02 exist twice: once as the app-native rows created in June
-- (STG-2605, ILW-2606) and once as the per-flush rows the sheet importer added
-- in July (T-01-F1..F3, T-02-F1..F4). The importer upserts batches on
-- `lot_code`, so the two naming schemes never collided — they just accumulated
-- side by side, and the duplicated harvests inflated recorded yield:
--
--   T-01  1.480 kg recorded  ->  1.035 kg actual  (+43%)
--   T-02  3.103 kg recorded  ->  1.952 kg actual  (+59%)
--
-- The sheet rows have to be the survivors: they carry the lot codes the
-- importer keys on, so deleting them would just bring them back on the next
-- sync. The app-native rows are not in the sheet, so removing them is stable.
--
-- But the app-native rows hold tub-level facts the sheet never had — substrate
-- weight, block count, the only two cycle ratings in the table, room, and the
-- colonized/fruiting dates. So this is a field-preserving merge, not a delete:
-- those values are folded onto the flush rows first (same approach as
-- migration 22's strain de-dup), and only then is the stale row removed.
--
-- Substrate weight and room are properties of the physical tub, so they go onto
-- every flush row of that tub — that makes each flush's bio-efficiency read as
-- "yield of this flush per kg of the tub's substrate", and the tub's total BE is
-- the sum. Block count and rating go onto the F1 row only, so that the
-- dashboard's blocks-in-production sum can't count the same blocks once per
-- flush.

begin;

-- 1. Keep the stage events; they'd otherwise be cascaded away with the row.
update public.stage_events set batch_id = (select id from public.batches where lot_code = 'T-01-F1')
 where batch_id = (select id from public.batches where lot_code = 'STG-2605');
update public.stage_events set batch_id = (select id from public.batches where lot_code = 'T-02-F1')
 where batch_id = (select id from public.batches where lot_code = 'ILW-2606');

-- 2. Tub-wide facts onto every flush row of the tub.
update public.batches f
   set substrate_weight_kg = case when f.substrate_weight_kg = 0
                                  then o.substrate_weight_kg else f.substrate_weight_kg end,
       room_id             = coalesce(f.room_id, o.room_id)
  from public.batches o
 where o.lot_code = 'STG-2605' and f.container_id = 'T-01' and f.lot_code <> o.lot_code;

update public.batches f
   set substrate_weight_kg = case when f.substrate_weight_kg = 0
                                  then o.substrate_weight_kg else f.substrate_weight_kg end,
       room_id             = coalesce(f.room_id, o.room_id)
  from public.batches o
 where o.lot_code = 'ILW-2606' and f.container_id = 'T-02' and f.lot_code <> o.lot_code;

-- 3. Single-instance facts onto the tub's first flush only.
update public.batches f
   set block_count   = case when f.block_count = 0 then o.block_count else f.block_count end,
       rating        = coalesce(f.rating, o.rating),
       colonized_on  = coalesce(f.colonized_on, o.colonized_on),
       fruiting_on   = coalesce(f.fruiting_on, o.fruiting_on),
       issues        = case
                         when o.issues = '' or position(o.issues in f.issues) > 0 then f.issues
                         when f.issues = '' then o.issues
                         else f.issues || ' || ' || o.issues
                       end
  from public.batches o
 where (o.lot_code, f.lot_code) in (('STG-2605','T-01-F1'), ('ILW-2606','T-02-F1'));

-- 4. Drop the duplicated harvests explicitly rather than leaning on the cascade,
--    so the intent is auditable. Every harvest on the two stale rows is either a
--    weight-for-weight duplicate of a sheet-sourced harvest on the same tub, or
--    a zero-weight placeholder; the query below only ever matches those.
delete from public.harvests dup
 using public.batches stale
 where dup.batch_id = stale.id
   and stale.lot_code in ('STG-2605','ILW-2606')
   and (
     dup.weight_kg = 0
     or exists (
       select 1 from public.harvests keep
       join public.batches kb on kb.id = keep.batch_id
       where kb.container_id = stale.container_id
         and keep.source_ref is not null
         and keep.weight_kg = dup.weight_kg
         and keep.dry_weight_kg = dup.dry_weight_kg
     )
   );

-- 5. Refuse to continue if anything unexpected still hangs off the stale rows —
--    better to abort than to cascade away a harvest nobody accounted for.
do $$
declare leftover int;
begin
  select count(*) into leftover
    from public.harvests h join public.batches b on b.id = h.batch_id
   where b.lot_code in ('STG-2605','ILW-2606');
  if leftover > 0 then
    raise exception 'Aborting: % unreviewed harvest(s) still attached to the stale batch rows', leftover;
  end if;
end $$;

-- 6. Remove the now-empty duplicates.
delete from public.batches where lot_code in ('STG-2605','ILW-2606');

commit;
