-- 16_rpcs_and_view_fixes — repair three things the app already depends on:
--
--   1. recall_trace(p_lot)          — called by web/app/(app)/traceability/actions.ts
--   2. generate_protocol_tasks(...) — called by web/app/(app)/batches/actions.ts
--      Neither function was defined in any prior migration, so both calls fail
--      against Postgres with PGRST202 "Could not find the function".
--
--   3. v_yield_by_strain / v_strain_scoreboard biological-efficiency double-count:
--      strains → batches → harvests is a one-to-many-to-many join, so summing
--      b.substrate_weight_kg over the fanned-out rows counted each batch's
--      substrate once per harvest, understating BE by ~1/flush-count. We
--      pre-aggregate per batch, then roll up per strain, and (matching the
--      FastAPI analytics) exclude non-harvested batches from the BE denominator.
--
-- Plus the missing hot-path indexes on the strain/picker join columns.
-- All statements are idempotent (create or replace / if not exists).

-- ── Forward recall trace ──────────────────────────────────────────────────
-- lot_code → batch → harvests → order_lines → orders → customers, returned as
-- the exact jsonb shape traceLot() expects: { strain, harvests, affected_orders[] }.
create or replace function public.recall_trace(p_lot text)
returns jsonb
language sql
stable
security invoker
as $$
  with b as (
    select id, strain_id from public.batches where lot_code = p_lot limit 1
  ),
  hs as (
    select h.id from public.harvests h join b on h.batch_id = b.id
  ),
  affected as (
    select
      o.order_number,
      c.name            as customer,
      o.channel,
      p.name            as product,
      ol.quantity,
      o.fulfillment_date
    from public.order_lines ol
    join public.orders    o on o.id = ol.order_id
    left join public.customers c on c.id = o.customer_id
    left join public.products  p on p.id = ol.product_id
    where ol.harvest_id in (select id from hs)
    order by o.fulfillment_date desc nulls last, o.order_number
  )
  select jsonb_build_object(
    'strain',          (select s.name from public.strains s join b on s.id = b.strain_id),
    'harvests',        (select count(*) from hs),
    'affected_orders', coalesce((select jsonb_agg(to_jsonb(affected)) from affected), '[]'::jsonb)
  );
$$;

-- ── Protocol → tasks generator ────────────────────────────────────────────
-- Expands a protocol's ordered `steps` array into one task per step, optionally
-- scoped to a batch. Returns the number of tasks created.
create or replace function public.generate_protocol_tasks(
  p_protocol_id bigint,
  p_batch_id    bigint default null
)
returns integer
language plpgsql
security invoker
as $$
declare
  v_name  text;
  v_steps jsonb;
  v_step  text;
  v_count int := 0;
begin
  select name, steps into v_name, v_steps
  from public.protocols
  where id = p_protocol_id;

  if not found then
    return 0;
  end if;

  for v_step in select jsonb_array_elements_text(coalesce(v_steps, '[]'::jsonb))
  loop
    -- Skip empty step strings rather than create blank tasks.
    if length(btrim(v_step)) = 0 then
      continue;
    end if;
    insert into public.tasks (title, description, batch_id, status, priority)
    values (v_step, 'From protocol: ' || coalesce(v_name, ''), p_batch_id, 'open', 'med');
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.recall_trace(text)                     to authenticated;
grant execute on function public.generate_protocol_tasks(bigint, bigint) to authenticated;

-- ── Biological-efficiency views (fan-out fix) ─────────────────────────────
create or replace view public.v_yield_by_strain with (security_invoker = on) as
with batch_roll as (
  select
    b.id,
    b.strain_id,
    b.substrate_weight_kg,
    coalesce(sum(h.weight_kg), 0) as fresh_kg,
    count(h.id)                   as harvest_count
  from public.batches b
  left join public.harvests h on h.batch_id = b.id
  group by b.id, b.strain_id, b.substrate_weight_kg
)
select
  s.id                                        as strain_id,
  s.name                                      as strain,
  count(br.id)                                as batches,
  coalesce(sum(br.fresh_kg), 0)               as fresh_kg,
  case
    when coalesce(sum(br.substrate_weight_kg) filter (where br.harvest_count > 0), 0) > 0
    then round(
      sum(br.fresh_kg)
      / sum(br.substrate_weight_kg) filter (where br.harvest_count > 0)
      * 100, 1)
    else null
  end                                         as biological_efficiency_pct
from public.strains s
left join batch_roll br on br.strain_id = s.id
group by s.id, s.name;

create or replace view public.v_strain_scoreboard with (security_invoker = on) as
with batch_roll as (
  select
    b.id,
    b.strain_id,
    b.substrate_weight_kg,
    coalesce(sum(h.weight_kg), 0) as fresh_kg,
    count(h.id)                   as harvest_count
  from public.batches b
  left join public.harvests h on h.batch_id = b.id
  group by b.id, b.strain_id, b.substrate_weight_kg
),
harvest_roll as (
  select b.strain_id, h.dry_ratio_pct
  from public.harvests h
  join public.batches b on b.id = h.batch_id
)
select
  s.id,
  s.name,
  s.ease_rating,
  coalesce(sum(br.fresh_kg), 0)               as fresh_kg,
  case
    when coalesce(sum(br.substrate_weight_kg) filter (where br.harvest_count > 0), 0) > 0
    then round(
      sum(br.fresh_kg)
      / sum(br.substrate_weight_kg) filter (where br.harvest_count > 0)
      * 100, 1)
    else null
  end                                         as biological_efficiency_pct,
  (select round(avg(hr.dry_ratio_pct), 1)
     from harvest_roll hr where hr.strain_id = s.id) as avg_dry_ratio
from public.strains s
left join batch_roll br on br.strain_id = s.id
group by s.id, s.name, s.ease_rating;

grant select on public.v_yield_by_strain, public.v_strain_scoreboard to authenticated;

-- ── Missing hot-path indexes ──────────────────────────────────────────────
create index if not exists idx_batches_strain_id  on public.batches (strain_id);
create index if not exists idx_products_strain_id on public.products (strain_id);
create index if not exists idx_harvests_picker_id on public.harvests (picker_id);
