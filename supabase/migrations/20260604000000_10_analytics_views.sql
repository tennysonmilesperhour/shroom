-- 10_analytics_views — backfill the five analytics views that page code
-- already references but no prior migration defined. Without these, dashboard
-- queries silently return errors and the app renders zeros that look like
-- "no data" instead of "broken query".
--
-- All views use `security_invoker = on` so they execute under the caller's
-- role and inherit the base-table RLS — never expanding access.

-- DRY_FLOOR (the 7.5% quality rule) lives in app code (lib/format.ts) and is
-- also the threshold below which a harvest is flagged here.

-- v_dry_ratio — one row per harvest, with strain + flush + quality flag.
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
  (h.dry_ratio_pct < 7.5)           as below_floor
from public.harvests h
join public.batches  b on b.id = h.batch_id
join public.strains  s on s.id = b.strain_id;

-- v_yield_by_strain — aggregate fresh weight + bio-efficiency by strain.
-- Biological efficiency = fresh yield / substrate weight × 100.
create or replace view public.v_yield_by_strain with (security_invoker = on) as
select
  s.id                          as strain_id,
  s.name                        as strain,
  count(distinct b.id)          as batches,
  coalesce(sum(h.weight_kg), 0) as fresh_kg,
  case
    when coalesce(sum(b.substrate_weight_kg), 0) > 0
    then round(sum(h.weight_kg) / sum(b.substrate_weight_kg) * 100, 1)
    else null
  end                           as biological_efficiency_pct
from public.strains s
left join public.batches  b on b.strain_id = s.id
left join public.harvests h on h.batch_id  = b.id
group by s.id, s.name;

-- v_environment_status — latest reading per room, with in-spec flag.
create or replace view public.v_environment_status with (security_invoker = on) as
with latest as (
  select distinct on (room_id)
    room_id, temp_c, humidity, co2_ppm, fae_per_hr, recorded_at
  from public.environment_readings
  order by room_id, recorded_at desc
)
select
  r.id                  as room_id,
  r.name                as room,
  r.room_type,
  r.target_temp_c,
  r.target_humidity,
  r.target_co2_ppm,
  r.target_fae_per_hr,
  l.temp_c,
  l.humidity,
  l.co2_ppm,
  l.fae_per_hr,
  l.recorded_at,
  (
    l.temp_c     between (r.target_temp_c   - 3) and (r.target_temp_c   + 3) and
    l.humidity   between (r.target_humidity - 8) and (r.target_humidity + 5) and
    l.co2_ppm    <= (r.target_co2_ppm + 400)                                 and
    l.fae_per_hr >= (r.target_fae_per_hr - 1)
  )                     as in_spec
from public.rooms r
left join latest l on l.room_id = r.id;

-- v_strain_scoreboard — portfolio optimizer view. One row per strain with
-- aggregate quality + ease signals so reports can rank candidates.
create or replace view public.v_strain_scoreboard with (security_invoker = on) as
select
  s.id,
  s.name,
  s.ease_rating,
  coalesce(sum(h.weight_kg), 0) as fresh_kg,
  case
    when coalesce(sum(b.substrate_weight_kg), 0) > 0
    then round(sum(h.weight_kg) / sum(b.substrate_weight_kg) * 100, 1)
    else null
  end                           as biological_efficiency_pct,
  case
    when count(h.id) > 0 then round(avg(h.dry_ratio_pct), 1)
    else null
  end                           as avg_dry_ratio
from public.strains s
left join public.batches  b on b.strain_id = s.id
left join public.harvests h on h.batch_id  = b.id
group by s.id, s.name, s.ease_rating;

-- v_circular_economy — operation-wide circularity summary. Estimates the
-- diverted CO2e from spent-block reuse using a conservative 0.35 kg CO2e per
-- kg of substrate diverted (rough average from compost / mycelium reuse
-- studies; tune to the operation's actual sink). Spent substrate weight is
-- summed from batches that have moved past the 'spent' stage.
create or replace view public.v_circular_economy with (security_invoker = on) as
select
  coalesce(sum(b.substrate_weight_kg), 0)            as spent_substrate_kg,
  round(coalesce(sum(b.substrate_weight_kg), 0) * 0.35, 1)
                                                     as estimated_co2e_diverted_kg
from public.batches b
where b.stage in ('spent', 'composted');

-- Grant SELECT to authenticated; anon stays excluded.
grant select on
  public.v_dry_ratio,
  public.v_yield_by_strain,
  public.v_environment_status,
  public.v_strain_scoreboard,
  public.v_circular_economy
to authenticated;
