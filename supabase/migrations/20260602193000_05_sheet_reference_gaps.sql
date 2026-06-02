-- 05_sheet_reference_gaps: additive gap-fill from the Master Cultivation
-- Reference sheet. New reference tables + columns; nothing existing is dropped
-- or renamed. The sheet itself is treated as read-only reference.

create table public.equipment (
  id bigint generated always as identity primary key,
  name text not null,
  spec_notes text not null default '',
  status text not null default 'active',          -- active / ordered / retired
  last_checked text not null default '',
  room_id bigint references public.rooms(id)
);

create table public.vendors (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null default 'supplies',       -- supplies / spores / functional / sourcing
  products text not null default '',
  url text not null default '',
  rating int,
  contact_priority text not null default '',
  notes text not null default ''
);

create table public.protocols (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null default 'sop',
  steps jsonb not null default '[]'::jsonb,         -- ordered array of step strings
  notes text not null default ''
);

create table public.reference_guides (
  id bigint generated always as identity primary key,
  guide_type text not null,                         -- 'contamination' | 'symptom'
  label text not null,
  appearance text not null default '',
  cause text not null default '',
  action text not null default ''
);

create table public.issue_log (
  id bigint generated always as identity primary key,
  log_date date,
  issue text not null,
  root_cause text not null default '',
  resolution text not null default '',
  batch_id bigint references public.batches(id) on delete set null
);

create table public.dry_inventory (
  id bigint generated always as identity primary key,
  jar_id text not null,
  strain_id bigint references public.strains(id),
  harvest_id bigint references public.harvests(id),
  flush_number int,
  dry_weight_g numeric not null default 0,
  used_g numeric not null default 0,
  remaining_g numeric generated always as (dry_weight_g - used_g) stored,
  location text not null default '',
  notes text not null default ''
);

create table public.price_tiers (
  id bigint generated always as identity primary key,
  tier text not null,                               -- wholesale/distributor/retail/farmers_market/restaurant/dtc
  product_class text not null default 'medicinal',  -- medicinal / functional
  min_per_gram numeric,
  max_per_gram numeric,
  min_per_lb numeric,
  max_per_lb numeric,
  channel text not null default '',
  notes text not null default ''
);

alter table public.batches
  add column container_id text not null default '',
  add column container_type text not null default 'tub',   -- tub / grain_bag / aio
  add column mixed_on date,
  add column transferred_on date,
  add column first_pins_on date,
  add column rating int,                                    -- cycle rating /10
  add column issues text not null default '';

alter table public.strains
  add column priority int,                                  -- 1-5 (stars)
  add column acquired_on date,
  add column library_status text not null default '',       -- active/colonizing/inoculating/fridge/awaiting/ordered/en_route
  add column syringes_on_hand numeric not null default 0;

alter table public.customers
  add column status text not null default 'active',         -- lead/warm/active/not_contacted/integrated
  add column role text not null default '',
  add column price_tier text not null default '',
  add column volume_est text not null default '',
  add column region text not null default '',
  add column last_contact date,
  add column follow_up_date date,
  add column priority int;

-- Re-apply RLS + authenticated policy so the new tables are covered too.
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists auth_all on public.%I', t);
    execute format(
      'create policy auth_all on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;

-- NOTE: reference content (equipment, vendors, price tiers, SOP protocols,
-- contamination/troubleshooting guides, issue log, full strain library, jar
-- inventory, and the sales-lead CRM) is loaded as data, not DDL. It mirrors the
-- sheet's tabs and is intended as an editable in-app reference.
