-- Batch field workflows: photo history, lineage operations, reversible edits,
-- saved batch views, voice/text observations, and task completion automations.
--
-- The `batch-media` Storage bucket is created through the Storage API on the
-- first upload. Supabase treats the storage schema as API-owned, so this
-- migration intentionally does not write directly to storage.buckets/objects.

alter table public.batches
  add column if not exists lineage_parent_id bigint
    references public.batches(id) on delete set null;

create index if not exists batches_lineage_parent_idx
  on public.batches(lineage_parent_id);

create table if not exists public.batch_media (
  id bigint generated always as identity primary key,
  batch_id bigint not null references public.batches(id) on delete cascade,
  storage_path text not null unique,
  original_filename text not null default '',
  mime_type text not null,
  byte_size bigint not null default 0 check (byte_size >= 0),
  stage_snapshot text not null,
  categories text[] not null default '{}',
  captured_at timestamptz not null default now(),
  note text not null default '',
  is_cover boolean not null default false,
  client_mutation_id uuid unique,
  created_at timestamptz not null default now(),
  check (stage_snapshot in ('colonization', 'spawn_to_bulk', 'fruiting', 'harvesting', 'spent')),
  check (cardinality(categories) between 1 and 8),
  check (categories <@ array[
    'overview', 'top', 'side', 'underside', 'colonization', 'pinning',
    'fruiting_body', 'contamination', 'harvest', 'label'
  ]::text[])
);

create index if not exists batch_media_batch_time_idx
  on public.batch_media(batch_id, captured_at desc);
create index if not exists batch_media_categories_idx
  on public.batch_media using gin(categories);

-- Preserve exactly one cover image per batch while allowing any number of
-- ordinary images.
create unique index if not exists batch_media_one_cover_idx
  on public.batch_media(batch_id) where is_cover;

create table if not exists public.batch_observations (
  id bigint generated always as identity primary key,
  batch_id bigint not null references public.batches(id) on delete cascade,
  observed_at timestamptz not null default now(),
  stage_snapshot text not null,
  kind text not null default 'note'
    check (kind in ('note', 'voice', 'room_round', 'exception')),
  transcript text not null,
  tags text[] not null default '{}',
  client_mutation_id uuid unique,
  created_at timestamptz not null default now()
);

create index if not exists batch_observations_batch_time_idx
  on public.batch_observations(batch_id, observed_at desc);

create table if not exists public.batch_change_events (
  id bigint generated always as identity primary key,
  group_id uuid not null,
  batch_id bigint references public.batches(id) on delete set null,
  batch_lot_code text not null,
  action text not null,
  before_state jsonb not null default '{}'::jsonb,
  after_state jsonb not null default '{}'::jsonb,
  undo_expires_at timestamptz not null default (now() + interval '10 minutes'),
  undone_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists batch_change_events_batch_time_idx
  on public.batch_change_events(batch_id, created_at desc);
create index if not exists batch_change_events_group_idx
  on public.batch_change_events(group_id);

create table if not exists public.saved_batch_views (
  id bigint generated always as identity primary key,
  name text not null unique,
  filters jsonb not null default '{}'::jsonb,
  is_favorite boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.tasks
  add column if not exists completion_action text not null default 'none',
  add column if not exists completion_stage text,
  add column if not exists completion_room_id bigint
    references public.rooms(id) on delete set null,
  add column if not exists completed_at timestamptz;

alter table public.tasks
  drop constraint if exists tasks_completion_action_check;
alter table public.tasks
  add constraint tasks_completion_action_check
  check (completion_action in ('none', 'advance_stage', 'set_stage', 'move_room'));

create index if not exists tasks_completion_room_idx
  on public.tasks(completion_room_id);

-- Newer Supabase projects no longer expose new public tables through the Data
-- API automatically. This app performs every database operation on the server
-- with its service-role client, so the workflow tables intentionally remain
-- unavailable to browser roles.
grant select, insert, update, delete on table
  public.batch_media,
  public.batch_observations,
  public.batch_change_events,
  public.saved_batch_views
to service_role;

revoke all on table
  public.batch_media,
  public.batch_observations,
  public.batch_change_events,
  public.saved_batch_views
from anon, authenticated;

grant usage, select on sequence
  public.batch_media_id_seq,
  public.batch_observations_id_seq,
  public.batch_change_events_id_seq,
  public.saved_batch_views_id_seq
to service_role;

revoke all on sequence
  public.batch_media_id_seq,
  public.batch_observations_id_seq,
  public.batch_change_events_id_seq,
  public.saved_batch_views_id_seq
from anon, authenticated;

do $$
declare t text;
begin
  for t in
    select unnest(array[
      'batch_media',
      'batch_observations',
      'batch_change_events',
      'saved_batch_views'
    ])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists auth_all on public.%I', t);
  end loop;
end $$;

-- Give generated SOP tasks explicit completion behavior only when the wording
-- clearly names a lifecycle transition. Ambiguous protocol steps remain
-- ordinary tasks and never mutate production records implicitly.
create or replace function public.generate_protocol_tasks(
  p_protocol_id bigint,
  p_batch_id bigint default null
)
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_name text;
  v_steps jsonb;
  v_step text;
  v_action text;
  v_stage text;
  v_count int := 0;
begin
  select name, steps into v_name, v_steps
  from public.protocols
  where id = p_protocol_id;

  if not found then return 0; end if;

  for v_step in select jsonb_array_elements_text(coalesce(v_steps, '[]'::jsonb))
  loop
    if length(btrim(v_step)) = 0 then continue; end if;

    v_action := 'none';
    v_stage := null;
    if v_step ~* '(do not|don''t|avoid|never)' then
      v_action := 'none';
    elsif v_step ~* '(move|enter|start).*(spawn[ _-]?to[ _-]?bulk|bulk)' then
      v_action := 'set_stage'; v_stage := 'spawn_to_bulk';
    elsif v_step ~* '(move|enter|start).*(fruit)' then
      v_action := 'set_stage'; v_stage := 'fruiting';
    elsif v_step ~* '(move|enter|start).*(harvest)' then
      v_action := 'set_stage'; v_stage := 'harvesting';
    elsif v_step ~* '(mark|move|retire|dispose).*(spent|discard)' then
      v_action := 'set_stage'; v_stage := 'spent';
    end if;

    insert into public.tasks (
      title, description, batch_id, status, priority,
      completion_action, completion_stage
    ) values (
      v_step, 'From protocol: ' || coalesce(v_name, ''), p_batch_id,
      'open', 'med', v_action, v_stage
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.generate_protocol_tasks(bigint, bigint)
  from anon, authenticated, public;
grant execute on function public.generate_protocol_tasks(bigint, bigint)
  to service_role;

-- Atomic split: move a proportional share of units, substrate, and material
-- quantities into a child batch while retaining the parent's lineage.
create or replace function public.split_batch(
  p_source_id bigint,
  p_lot_code text,
  p_container_id text,
  p_units integer
)
returns bigint
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  src public.batches%rowtype;
  child_id bigint;
  ratio numeric;
begin
  select * into src from public.batches where id = p_source_id for update;
  if not found then raise exception 'Batch not found'; end if;
  if p_units <= 0 or p_units >= src.block_count then
    raise exception 'Split units must be between 1 and %', src.block_count - 1;
  end if;
  if length(btrim(p_lot_code)) = 0 then raise exception 'Lot code is required'; end if;

  ratio := p_units::numeric / src.block_count::numeric;

  insert into public.batches (
    lot_code, strain_id, recipe_id, room_id, stage, block_count,
    substrate_weight_kg, inoculated_on, colonized_on, fruiting_on, spent_on,
    contamination_flag, notes, container_id, container_type, mixed_on,
    transferred_on, first_pins_on, rating, issues, preset_id, tub_size,
    spawn_type, substrate_type, bag_type, lineage_parent_id
  ) values (
    btrim(p_lot_code), src.strain_id, src.recipe_id, src.room_id, src.stage,
    p_units, round(src.substrate_weight_kg * ratio, 3), src.inoculated_on,
    src.colonized_on, src.fruiting_on, src.spent_on, src.contamination_flag,
    src.notes, btrim(p_container_id), src.container_type, src.mixed_on,
    src.transferred_on, src.first_pins_on, src.rating, src.issues, src.preset_id,
    src.tub_size, src.spawn_type, src.substrate_type, src.bag_type, src.id
  ) returning id into child_id;

  insert into public.batch_materials (
    batch_id, inventory_item_id, name, quantity, unit, created_at
  )
  select child_id, inventory_item_id, name, round(quantity * ratio, 3), unit, created_at
  from public.batch_materials where batch_id = src.id;

  update public.batch_materials
    set quantity = round(quantity * (1 - ratio), 3)
    where batch_id = src.id;

  update public.batches
    set block_count = block_count - p_units,
        substrate_weight_kg = round(substrate_weight_kg * (1 - ratio), 3)
    where id = src.id;

  insert into public.stage_events(batch_id, stage, room_id, block_count, note)
  values
    (src.id, 'split', src.room_id, src.block_count - p_units,
      'Split child batch ' || btrim(p_lot_code)),
    (child_id, 'split', src.room_id, p_units,
      'Split from ' || src.lot_code);

  return child_id;
end;
$$;

-- Atomic compatible merge. Histories and downstream traceability rows move to
-- the surviving destination; lot-code snapshots in change history remain intact.
create or replace function public.merge_batches(
  p_destination_id bigint,
  p_source_ids bigint[]
)
returns bigint
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  dest public.batches%rowtype;
  source_count integer;
  compatible_count integer;
  moved_units integer;
  moved_weight numeric;
begin
  select * into dest from public.batches where id = p_destination_id for update;
  if not found then raise exception 'Destination batch not found'; end if;

  p_source_ids := array(
    select distinct x from unnest(coalesce(p_source_ids, '{}')) x
    where x <> p_destination_id
  );
  source_count := cardinality(p_source_ids);
  if source_count = 0 then raise exception 'Select at least one source batch'; end if;

  -- Freeze sources before validating compatibility so their stage, strain,
  -- and unit counts cannot change halfway through the merge.
  perform 1 from public.batches
  where id = any(p_source_ids)
  order by id
  for update;

  select count(*) into compatible_count
  from public.batches
  where id = any(p_source_ids)
    and strain_id = dest.strain_id
    and stage = dest.stage;
  if compatible_count <> source_count then
    raise exception 'Batches must exist and share the destination strain and stage';
  end if;

  select coalesce(sum(block_count), 0), coalesce(sum(substrate_weight_kg), 0)
    into moved_units, moved_weight
  from public.batches where id = any(p_source_ids);

  update public.batch_media set is_cover = false where batch_id = any(p_source_ids);
  update public.harvests set batch_id = p_destination_id where batch_id = any(p_source_ids);
  update public.contamination_logs set batch_id = p_destination_id where batch_id = any(p_source_ids);
  update public.stage_events set batch_id = p_destination_id where batch_id = any(p_source_ids);
  update public.batch_materials set batch_id = p_destination_id where batch_id = any(p_source_ids);
  update public.batch_media set batch_id = p_destination_id where batch_id = any(p_source_ids);
  update public.batch_observations set batch_id = p_destination_id where batch_id = any(p_source_ids);
  update public.tasks set batch_id = p_destination_id where batch_id = any(p_source_ids);
  update public.issue_log set batch_id = p_destination_id where batch_id = any(p_source_ids);
  -- Source-lot history remains readable through its lot-code snapshot, but is
  -- detached so a still-live undo window can never apply an old source patch
  -- to the surviving destination.
  update public.batch_change_events set batch_id = null where batch_id = any(p_source_ids);
  update public.batches set lineage_parent_id = p_destination_id
    where lineage_parent_id = any(p_source_ids) and id <> p_destination_id;

  update public.batches
    set block_count = block_count + moved_units,
        substrate_weight_kg = substrate_weight_kg + moved_weight
    where id = p_destination_id;

  delete from public.batches where id = any(p_source_ids);

  insert into public.stage_events(batch_id, stage, room_id, block_count, note)
  values (
    p_destination_id, 'merged', dest.room_id, dest.block_count + moved_units,
    'Merged ' || source_count || ' compatible batch' ||
      case when source_count = 1 then '' else 'es' end
  );

  return p_destination_id;
end;
$$;

revoke execute on function public.split_batch(bigint, text, text, integer)
  from anon, authenticated, public;
revoke execute on function public.merge_batches(bigint, bigint[])
  from anon, authenticated, public;
grant execute on function public.split_batch(bigint, text, text, integer)
  to service_role;
grant execute on function public.merge_batches(bigint, bigint[])
  to service_role;
