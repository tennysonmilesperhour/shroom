-- 17_harvest_sku — tag each flush (harvest) with an operator-facing SKU so the
-- dried yield can be labelled, inventoried, and sold under a consistent number.
-- Free text to fit any numbering scheme. Additive and idempotent.

alter table public.harvests
  add column if not exists sku text not null default '';

-- Fast lookup by SKU (label scans, sales linking). Partial: only non-empty.
create index if not exists idx_harvests_sku
  on public.harvests (sku)
  where sku <> '';

-- Surface the SKU on the dry-ratio view the harvest UIs read from. `create or
-- replace view` only allows appending new columns at the END (it can't reorder
-- or rename existing ones), so sku goes last — matching migration 10's column
-- order for the rest.
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
  (h.dry_ratio_pct < 7.5)           as below_floor,
  h.sku
from public.harvests h
join public.batches  b on b.id = h.batch_id
join public.strains  s on s.id = b.strain_id;
