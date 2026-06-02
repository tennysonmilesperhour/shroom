-- 01_core_schema: Shroom OS cultivation + operations + business + traceability.
-- Mirrors the SQLAlchemy models. ids are bigint identity; money/weights numeric.

create table public.strains (
  id bigint generated always as identity primary key,
  name text not null,
  species text not null default '',
  strain_code text not null default '',
  mushroom_type text not null default 'functional',      -- psychedelic/functional/gourmet
  vendor text not null default '',
  genetics text not null default '',
  potency text not null default '',
  ease_rating int not null default 3,                     -- 1 (hard) - 5 (easy)
  grow_again boolean not null default true,
  lineage_parent_id bigint references public.strains(id),
  generation int not null default 0,
  target_temp_c numeric not null default 20,
  target_humidity numeric not null default 90,
  target_co2_ppm numeric not null default 800,
  typical_be numeric not null default 75,                 -- typical biological efficiency %
  typical_flushes int not null default 3,
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.recipes (
  id bigint generated always as identity primary key,
  name text not null,
  description text not null default '',
  block_weight_kg numeric not null default 2.5,
  prep_notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.recipe_ingredients (
  id bigint generated always as identity primary key,
  recipe_id bigint not null references public.recipes(id) on delete cascade,
  name text not null,
  quantity numeric not null default 0,
  unit text not null default 'kg',
  unit_cost numeric not null default 0
);
create index on public.recipe_ingredients (recipe_id);

create table public.rooms (
  id bigint generated always as identity primary key,
  name text not null,
  room_type text not null default 'fruiting',
  capacity_blocks int not null default 0,
  target_temp_c numeric not null default 20,
  target_humidity numeric not null default 90,
  target_co2_ppm numeric not null default 800,
  target_fae_per_hr numeric not null default 4,           -- fresh-air exchanges / hr
  notes text not null default ''
);

create table public.staff (
  id bigint generated always as identity primary key,
  name text not null,
  role text not null default 'picker',
  hourly_rate numeric not null default 18,
  active boolean not null default true,
  user_id uuid references auth.users(id)                  -- links a staff record to a login
);

create table public.batches (
  id bigint generated always as identity primary key,
  lot_code text not null unique,
  strain_id bigint not null references public.strains(id),
  recipe_id bigint references public.recipes(id),
  room_id bigint references public.rooms(id),
  stage text not null default 'inoculation',
  block_count int not null default 0,
  substrate_weight_kg numeric not null default 0,
  inoculated_on date,
  colonized_on date,
  fruiting_on date,
  spent_on date,
  contamination_flag boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index on public.batches (stage);

create table public.stage_events (
  id bigint generated always as identity primary key,
  batch_id bigint not null references public.batches(id) on delete cascade,
  stage text not null,
  room_id bigint references public.rooms(id),
  block_count int,
  occurred_at timestamptz not null default now(),
  note text not null default ''
);
create index on public.stage_events (batch_id);

create table public.environment_readings (
  id bigint generated always as identity primary key,
  room_id bigint not null references public.rooms(id) on delete cascade,
  recorded_at timestamptz not null default now(),
  temp_c numeric,
  humidity numeric,
  co2_ppm numeric,
  fae_per_hr numeric,
  source text not null default 'sensor'
);
create index on public.environment_readings (room_id, recorded_at desc);

create table public.harvests (
  id bigint generated always as identity primary key,
  batch_id bigint not null references public.batches(id) on delete cascade,
  harvested_on date not null,
  flush_number int not null default 1,
  weight_kg numeric not null default 0,                   -- fresh weight
  dry_weight_kg numeric not null default 0,
  -- Dry yield as a % of fresh weight, computed in-DB (the 7.5% quality rule).
  dry_ratio_pct numeric generated always as (
    case when weight_kg > 0 then round(dry_weight_kg / weight_kg * 100, 1) else 0 end
  ) stored,
  grade text not null default 'A',
  picker_id bigint references public.staff(id),
  labor_minutes numeric not null default 0,
  notes text not null default ''
);
create index on public.harvests (batch_id);

create table public.contamination_logs (
  id bigint generated always as identity primary key,
  batch_id bigint not null references public.batches(id) on delete cascade,
  observed_on date not null,
  contam_type text not null default 'other',
  severity text not null default 'low',
  action_taken text not null default '',
  photo_url text not null default '',
  reported_by text not null default ''
);
create index on public.contamination_logs (batch_id);

create table public.tasks (
  id bigint generated always as identity primary key,
  title text not null,
  description text not null default '',
  batch_id bigint references public.batches(id) on delete set null,
  room_id bigint references public.rooms(id) on delete set null,
  assigned_to bigint references public.staff(id),
  due_date date,
  status text not null default 'open',
  priority text not null default 'med',
  created_at timestamptz not null default now()
);

create table public.inventory_items (
  id bigint generated always as identity primary key,
  name text not null,
  category text not null default 'other',
  unit text not null default 'unit',
  quantity_on_hand numeric not null default 0,
  reorder_threshold numeric not null default 0,
  unit_cost numeric not null default 0,
  supplier text not null default '',
  location text not null default ''
);

create table public.customers (
  id bigint generated always as identity primary key,
  name text not null,
  channel text not null default 'wholesale',
  contact_email text not null default '',
  phone text not null default '',
  address text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.products (
  id bigint generated always as identity primary key,
  name text not null,
  sku text not null default '',
  strain_id bigint references public.strains(id),
  category text not null default 'fresh',
  unit text not null default 'g',
  price numeric not null default 0,                       -- retail price / unit
  distributor_price numeric not null default 0
);

create table public.orders (
  id bigint generated always as identity primary key,
  order_number text not null unique,
  customer_id bigint not null references public.customers(id),
  channel text not null default 'wholesale',
  order_date date not null,
  fulfillment_date date,
  status text not null default 'confirmed',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.order_lines (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.orders(id) on delete cascade,
  product_id bigint not null references public.products(id),
  -- The harvest (and therefore batch + lot) this line was fulfilled from:
  -- the single link that makes forward recall tracing possible.
  harvest_id bigint references public.harvests(id),
  quantity numeric not null default 0,
  unit_price numeric not null default 0
);
create index on public.order_lines (order_id);
create index on public.order_lines (harvest_id);

create table public.food_safety_logs (
  id bigint generated always as identity primary key,
  log_date date not null,
  category text not null default 'sanitation',
  description text not null default '',
  performed_by text not null default '',
  passed boolean not null default true,
  corrective_action text not null default '',
  created_at timestamptz not null default now()
);
