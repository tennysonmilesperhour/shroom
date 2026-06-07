-- Dashboard sparkline series.
--
-- Weekly rollups that back the KPI sparklines on the operations dashboard.
-- Each view returns the last ~16 weeks, one row per ISO week, ordered oldest →
-- newest so the client can map straight to a series array. All derive from real
-- rows (no synthesized trends); metrics without a real history (current
-- inventory valuation, which keeps no snapshots) intentionally have no view.
--
-- Convention mirrors 10_analytics_views.sql: security_invoker views granted to
-- authenticated. The dashboard reads with the service role (bypasses grants),
-- but we keep parity with the rest of the schema.

-- Weekly harvest weight + dry ratio, from harvests.harvested_on.
create or replace view public.v_harvest_weekly with (security_invoker = on) as
select
  date_trunc('week', h.harvested_on)::date            as week,
  round(sum(h.weight_kg) * 1000)::numeric             as fresh_g,
  round(sum(h.dry_weight_kg) * 1000)::numeric         as dry_g,
  case
    when sum(h.weight_kg) > 0
      then round(sum(h.dry_weight_kg) / sum(h.weight_kg) * 100, 1)
    else 0
  end                                                 as dry_ratio_pct,
  count(*)                                            as harvest_count
from public.harvests h
where h.harvested_on >= (current_date - interval '16 weeks')
group by 1
order by 1;

grant select on public.v_harvest_weekly to authenticated;

-- Weekly count of batches started, from batches.created_at.
create or replace view public.v_active_batches_weekly with (security_invoker = on) as
select
  date_trunc('week', b.created_at)::date  as week,
  count(*)                                as started,
  coalesce(sum(b.block_count), 0)         as blocks_started
from public.batches b
where b.created_at >= (current_date - interval '16 weeks')
group by 1
order by 1;

grant select on public.v_active_batches_weekly to authenticated;

-- Weekly count of tasks opened, from tasks.created_at.
create or replace view public.v_open_tasks_weekly with (security_invoker = on) as
select
  date_trunc('week', t.created_at)::date  as week,
  count(*)                                as opened
from public.tasks t
where t.created_at >= (current_date - interval '16 weeks')
group by 1
order by 1;

grant select on public.v_open_tasks_weekly to authenticated;
