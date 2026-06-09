-- 14_batch_presets: reusable "new tub" presets, one per mushroom type / recipe.
--
-- A preset bundles everything you'd otherwise re-type when starting a tub: the
-- spores (strain), the substrate recipe, the container + tub size, the spawn /
-- substrate / bag specs and the default quantities. Starting a batch then means
-- picking a preset and tweaking — every field is prefilled but still editable.
--
-- The optional per-preset bill-of-materials (preset_materials) links inventory
-- items so making a tub can draw stock down, and batch_materials records exactly
-- which materials each batch consumed — turning "what went into this tub" into
-- real, queryable history instead of a memory.

create table public.batch_presets (
  id bigint generated always as identity primary key,
  name text not null,                                  -- e.g. "Golden Teacher monotub"
  strain_id bigint references public.strains(id) on delete set null,
  recipe_id bigint references public.recipes(id) on delete set null,
  room_id bigint references public.rooms(id) on delete set null,
  container_type text not null default 'tub',          -- tub / grain_bag / aio
  tub_size text not null default '',                   -- e.g. "32 qt monotub"
  spawn_type text not null default '',                 -- e.g. "rye berries"
  substrate_type text not null default '',             -- e.g. "CVG"
  bag_type text not null default '',                   -- e.g. "Unicorn 3T grain bag"
  block_count int not null default 0,                  -- default units per batch
  substrate_weight_kg numeric not null default 0,
  spawn_weight_kg numeric not null default 0,
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Bill of materials: what one tub built from this preset consumes. inventory_item_id
-- ties to stock for draw-down; name/unit are snapshotted so a manual material (one
-- not in inventory) is still recordable and history survives an item rename/delete.
create table public.preset_materials (
  id bigint generated always as identity primary key,
  preset_id bigint not null references public.batch_presets(id) on delete cascade,
  inventory_item_id bigint references public.inventory_items(id) on delete set null,
  name text not null default '',
  quantity numeric not null default 0,
  unit text not null default 'unit'
);
create index on public.preset_materials (preset_id);

-- What a batch actually consumed at creation time — the material history / spine.
create table public.batch_materials (
  id bigint generated always as identity primary key,
  batch_id bigint not null references public.batches(id) on delete cascade,
  inventory_item_id bigint references public.inventory_items(id) on delete set null,
  name text not null default '',
  quantity numeric not null default 0,
  unit text not null default 'unit',
  created_at timestamptz not null default now()
);
create index on public.batch_materials (batch_id);

-- Persist the chosen variables on the batch itself so every tub carries its own
-- history even if the source preset is later edited or removed.
alter table public.batches
  add column preset_id bigint references public.batch_presets(id) on delete set null,
  add column tub_size text not null default '',
  add column spawn_type text not null default '',
  add column substrate_type text not null default '',
  add column bag_type text not null default '';

-- RLS: match the project-wide authenticated-access policy for the new tables.
do $$
declare t text;
begin
  for t in
    select unnest(array['batch_presets', 'preset_materials', 'batch_materials'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists auth_all on public.%I', t);
    execute format(
      'create policy auth_all on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
