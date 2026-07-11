-- 18_stage_supply_estimates: infer burn of *untracked* supplies from batch/stage
-- throughput.
--
-- Many consumables are never counted per use — isopropyl alcohol, gloves, filter
-- discs, agar. But we know roughly how much each stage eats, and how many batches
-- passed through each stage. Multiplying the two infers total usage. For wear
-- items swapped on a fixed cadence (`replace_after_batches` — e.g. flow-hood IPA
-- replaced every 50 batches) it also forecasts the next replacement, the one
-- signal there was otherwise no way to track.

create table public.stage_supply_estimates (
  id bigint generated always as identity primary key,
  stage text not null,                                  -- which stage's completion consumes it
  supply_name text not null,                            -- free text; matches untracked supplies too
  inventory_item_id bigint references public.inventory_items(id) on delete set null,
  unit text not null default 'unit',
  avg_qty numeric not null default 0,                   -- avg per batch (or per block) reaching the stage
  basis text not null default 'batch',                  -- 'batch' | 'block'
  replace_after_batches int,                            -- wear items: swap every N batches (null = pure consumable)
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.stage_supply_estimates (stage);

-- Stages a batch has reached: the linear main-path assumption (a batch at a given
-- stage has passed through every earlier stage) unioned with explicitly logged
-- stage_events. Off-path states (e.g. 'contaminated') contribute only what was logged.
create view public.v_batch_stages_reached with (security_invoker = on) as
with lifecycle(stage, ord) as (
  values ('inoculation', 0), ('colonization', 1), ('spawn_to_bulk', 2),
         ('fruiting', 3), ('harvesting', 4), ('spent', 5)
),
current_ord as (
  select b.id as batch_id, b.block_count, l.ord as cur_ord
  from public.batches b
  left join lifecycle l on l.stage = b.stage
),
linear as (
  select c.batch_id, c.block_count, l.stage
  from current_ord c
  join lifecycle l on c.cur_ord is not null and l.ord <= c.cur_ord
),
logged as (
  select se.batch_id, b.block_count, se.stage
  from public.stage_events se
  join public.batches b on b.id = se.batch_id
)
select batch_id, block_count, stage from linear
union
select batch_id, block_count, stage from logged;

-- Per-estimate inferred usage + replacement forecast.
create view public.v_stage_supply_usage with (security_invoker = on) as
select
  e.id as estimate_id,
  e.stage,
  e.supply_name,
  e.unit,
  e.basis,
  e.avg_qty,
  e.inventory_item_id,
  e.replace_after_batches,
  count(distinct r.batch_id)                              as batches_reached,
  coalesce(sum(r.block_count), 0)                         as blocks_reached,
  round(e.avg_qty * case when e.basis = 'block'
        then coalesce(sum(r.block_count), 0)
        else count(distinct r.batch_id) end, 3)           as inferred_used,
  -- Replacement cadence forecast (null for pure consumables).
  case when e.replace_after_batches is not null
       then count(distinct r.batch_id) / e.replace_after_batches end   as replacements_due,
  case when e.replace_after_batches is not null
       then e.replace_after_batches - (count(distinct r.batch_id) % e.replace_after_batches) end
                                                          as batches_until_next
from public.stage_supply_estimates e
left join public.v_batch_stages_reached r on r.stage = e.stage
where e.active
group by e.id;

-- Rolled up per supply — one supply used across several stages sums together.
create view public.v_supply_usage with (security_invoker = on) as
select
  u.supply_name,
  min(u.unit)                             as unit,
  round(sum(u.inferred_used), 3)          as inferred_used,
  max(u.replace_after_batches)            as replace_after_batches,
  (select i.quantity_on_hand from public.inventory_items i
   where i.id = max(u.inventory_item_id)) as on_hand
from public.v_stage_supply_usage u
group by u.supply_name;

-- RLS: match the project-wide authenticated-access policy.
alter table public.stage_supply_estimates enable row level security;
drop policy if exists auth_all on public.stage_supply_estimates;
create policy auth_all on public.stage_supply_estimates
  for all to authenticated using (true) with check (true);
