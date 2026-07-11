-- 21_analytics_consistency_fixes: make the web app's analytics views agree with
-- the canonical reference implementation in backend/app/routers/analytics.py.
-- Four surfaces on /reports (and /strains) diverged from the API for the same
-- data — the reference is authoritative, so the views are brought in line.
--
-- 1. Biological efficiency was fresh / WET substrate. BE is fresh / DRY
--    substrate; the reference assumes ~70% substrate moisture
--    (_biological_efficiency, analytics.py) so dry = wet * 0.30. Without the
--    factor the web BE% rendered ~3.3× too low.
-- 2. below_floor / avg_dry_ratio counted not-yet-dried harvests (dry_ratio = 0,
--    the default before the dried yield is weighed) as quality failures. The
--    reference guards 0 < ratio < floor (models.below_dry_floor).
-- 3. v_best_sellers summed cancelled orders; every sibling commerce view
--    excludes them.
-- 4. v_circular_economy used a 0.35 CO2e factor over ('spent','composted');
--    the reference uses 0.18 over 'spent' only.

-- Substrate dry fraction: 1 - 0.70 moisture, matching analytics._biological_efficiency.
-- (Kept inline as 0.30 in each view; documented here as the single rationale.)

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
      / (sum(br.substrate_weight_kg) filter (where br.harvest_count > 0) * 0.30)
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
      / (sum(br.substrate_weight_kg) filter (where br.harvest_count > 0) * 0.30)
      * 100, 1)
    else null
  end                                         as biological_efficiency_pct,
  -- Average only dried flushes; a not-yet-dried flush (ratio 0) isn't a 0% dry.
  (select round(avg(hr.dry_ratio_pct), 1)
     from harvest_roll hr
     where hr.strain_id = s.id and hr.dry_ratio_pct > 0) as avg_dry_ratio
from public.strains s
left join batch_roll br on br.strain_id = s.id
group by s.id, s.name, s.ease_rating;

-- v_dry_ratio: only flag a harvest below the 7.5% floor once it's actually been
-- dried (ratio > 0), matching backend/app/models.py below_dry_floor.
create or replace view public.v_dry_ratio with (security_invoker = on) as
select
  h.id                              as harvest_id,
  h.batch_id,
  b.lot_code,
  h.harvested_on,
  h.flush_number,
  s.id                              as strain_id,
  s.name                            as strain,
  (h.weight_kg * 1000)::numeric     as fresh_g,
  (h.dry_weight_kg * 1000)::numeric as dry_g,
  h.dry_ratio_pct,
  (h.dry_ratio_pct > 0 and h.dry_ratio_pct < 7.5) as below_floor,
  h.sku
from public.harvests h
join public.batches  b on b.id = h.batch_id
join public.strains  s on s.id = b.strain_id;

-- v_circular_economy: align factor + scope to /analytics/circular-economy
-- (0.18 kg CO2e per kg spent substrate, stage = 'spent' only).
create or replace view public.v_circular_economy with (security_invoker = on) as
select
  coalesce(sum(b.substrate_weight_kg), 0)            as spent_substrate_kg,
  round(coalesce(sum(b.substrate_weight_kg), 0) * 0.18, 1)
                                                     as estimated_co2e_diverted_kg
from public.batches b
where b.stage = 'spent';

-- v_best_sellers: exclude cancelled orders, matching every sibling commerce
-- view. Zero-sale products still appear (units/revenue 0).
create or replace view public.v_best_sellers with (security_invoker = on) as
select
  p.id as product_id,
  p.name,
  coalesce(sum(ol.quantity) filter (where o.status is distinct from 'cancelled'), 0) as units,
  round(coalesce(sum(ol.quantity * ol.unit_price)
                 filter (where o.status is distinct from 'cancelled'), 0), 2) as revenue
from public.products p
left join public.order_lines ol on ol.product_id = p.id
left join public.orders o on o.id = ol.order_id
group by p.id, p.name
order by revenue desc;

grant select on
  public.v_yield_by_strain,
  public.v_strain_scoreboard,
  public.v_dry_ratio,
  public.v_circular_economy,
  public.v_best_sellers
to authenticated;
