-- 14_culture_inventory: a dedicated stock register for the living front of the
-- pipeline — spore prints/swabs/syringes, agar plates, liquid cultures, grain
-- spawn and long-term slants. Until now this lived only as a per-strain
-- `syringes_on_hand` count on `strains`; this gives each physical culture/spore
-- unit its own row so it can be tracked *through its lifecycle*:
--
--   ordered -> in_transit -> stored (in the fridge, ready to inoculate)
--           -> inoculating -> colonizing -> ready (to use / spawn to bulk)
--           -> consumed | contaminated
--
-- That mirrors the existing `strains.library_status` vocabulary
-- (ordered/en_route/fridge/inoculating/colonizing/active) so both surfaces
-- speak the same language. Additive: nothing existing is dropped or renamed.

create table public.culture_inventory (
  id bigint generated always as identity primary key,
  label text not null,
  -- form / medium of the unit
  -- spore_print / spore_swab / spore_syringe / agar_plate / liquid_culture / grain_spawn / slant
  culture_type text not null default 'spore_syringe',
  strain_id bigint references public.strains(id) on delete set null,
  -- lifecycle stage (see header). Defaults to in-the-fridge/ready-to-inoculate.
  status text not null default 'stored',
  quantity_on_hand numeric not null default 1,
  unit text not null default 'unit',
  reorder_threshold numeric not null default 0,
  location text not null default '',                 -- fridge shelf / lab / incubator
  source text not null default '',                   -- vendor or clone parent
  acquired_on date,
  -- shelf-life: refrigerated spore syringes stay viable ~8-12 months; an
  -- expires_on past today flags the unit as aging-out on the inventory view.
  expires_on date,
  notes text not null default ''
);

create index culture_inventory_strain_idx on public.culture_inventory (strain_id);
create index culture_inventory_status_idx on public.culture_inventory (status);

-- Match the project-wide RLS posture: enabled, with a single authenticated-all
-- policy (mirrors every other public table — see migration 05).
alter table public.culture_inventory enable row level security;
drop policy if exists auth_all on public.culture_inventory;
create policy auth_all on public.culture_inventory
  for all to authenticated using (true) with check (true);
