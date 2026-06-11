-- 15_master_sheet_import: make the Master Cultivation Reference .xlsx the live
-- source of truth. The importer (backend/app/sheet) upserts each tab into these
-- tables, so every table it targets needs a natural key to upsert on. This
-- migration adds those unique keys, plus two tables for tabs that had no home
-- (Sourced Finished Goods, Sales Log) and a run log for the sync job. Purely
-- additive — nothing is dropped or renamed.

-- --- Natural keys for idempotent upserts (PostgREST on_conflict targets) --- #
create unique index if not exists strains_name_uniq          on public.strains (name);
create unique index if not exists vendors_name_uniq          on public.vendors (name);
create unique index if not exists equipment_name_uniq        on public.equipment (name);
create unique index if not exists customers_name_uniq        on public.customers (name);
create unique index if not exists protocols_name_uniq        on public.protocols (name);
create unique index if not exists dry_inventory_jar_uniq     on public.dry_inventory (jar_id);
create unique index if not exists price_tiers_tier_class_uniq on public.price_tiers (tier, product_class);
create unique index if not exists reference_guides_type_label_uniq
  on public.reference_guides (guide_type, label);

-- Append-only logs upsert on a content hash so a re-import is a no-op, not a
-- duplicate. The hash is computed by the importer from the row's key fields.
alter table public.issue_log add column if not exists source_hash text;
create unique index if not exists issue_log_source_hash_uniq
  on public.issue_log (source_hash) where source_hash is not null;

-- A harvest row maps 1:1 to a (tub, flush) in the sheet; source_ref carries the
-- synthesized lot code so re-imports update the same harvest.
alter table public.harvests add column if not exists source_ref text;
create unique index if not exists harvests_source_ref_uniq
  on public.harvests (source_ref) where source_ref is not null;

-- --- New tables for tabs that had no schema home ------------------------- #

-- "Sourced Finished Goods" — externally sourced product backing the menu
-- (Cosmos, Bluey Vuittons, White Ape, Tidal Wave) that isn't grown in-house.
create table if not exists public.sourced_finished_goods (
  id          bigint generated always as identity primary key,
  strain      text not null unique,
  on_hand_g   numeric not null default 0,
  used_g      numeric not null default 0,
  remaining_g numeric generated always as (on_hand_g - used_g) stored,
  incoming    text not null default '',
  last_updated date,
  notes       text not null default '',
  created_at  timestamptz not null default now()
);

-- "Sales Log" — one row per transaction. row_hash makes re-imports idempotent.
create table if not exists public.sales_log (
  id           bigint generated always as identity primary key,
  sale_date    date,
  buyer        text not null default '',
  strains      text not null default '',
  grams        numeric,
  amount       numeric,
  tier         text not null default '',
  source_notes text not null default '',
  payment      text not null default '',
  row_hash     text not null unique,
  created_at   timestamptz not null default now()
);

-- One row per importer execution, for observability of the live sync.
create table if not exists public.sheet_imports (
  id            bigint generated always as identity primary key,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  source        text not null default '',
  status        text not null default 'ok',     -- ok / error
  rows_upserted jsonb not null default '{}'::jsonb,
  detail        text not null default ''
);

-- --- RLS for the new tables (matches every other table in this schema) ---- #
do $$
declare t text;
begin
  for t in
    select unnest(array['sourced_finished_goods', 'sales_log', 'sheet_imports'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists auth_all on public.%I', t);
    execute format(
      'create policy auth_all on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
