-- Archiving changes visibility only. Harvest/order FKs and historic reports remain intact.
alter table public.batches add column archived_at timestamptz;
create index batches_active_idx on public.batches(id) where archived_at is null;

-- Legacy zero weights have unknown completeness; do not invent a meaning.
alter table public.harvests add column fresh_weight_recorded boolean, add column dry_weight_recorded boolean;
update public.harvests set fresh_weight_recorded = true where weight_kg > 0;
update public.harvests set dry_weight_recorded = true where dry_weight_kg > 0;
create or replace view public.v_dry_ratio with (security_invoker = on) as
select h.id as harvest_id,h.batch_id,b.lot_code,h.harvested_on,h.flush_number,s.id as strain_id,s.name as strain,
  case when h.fresh_weight_recorded then (h.weight_kg * 1000)::numeric end as fresh_g,
  case when h.dry_weight_recorded then (h.dry_weight_kg * 1000)::numeric end as dry_g,
  case when h.fresh_weight_recorded and h.dry_weight_recorded then h.dry_ratio_pct end as dry_ratio_pct,
  case when h.fresh_weight_recorded and h.dry_weight_recorded then (h.dry_ratio_pct > 0 and h.dry_ratio_pct < 7.5) end as below_floor,
  h.sku
from public.harvests h join public.batches b on b.id=h.batch_id join public.strains s on s.id=b.strain_id;

create table public.harvest_revisions (
  id bigint generated always as identity primary key,
  harvest_id bigint not null,
  before_state jsonb not null,
  after_state jsonb not null,
  source text not null,
  created_at timestamptz not null default now()
);
alter table public.harvest_revisions enable row level security;
grant select, insert on public.harvest_revisions to service_role;
grant usage, select on sequence public.harvest_revisions_id_seq to service_role;
create function public.record_harvest_revision() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if to_jsonb(old) is distinct from to_jsonb(new) then
    insert into public.harvest_revisions(harvest_id,before_state,after_state,source)
    values(old.id,to_jsonb(old),to_jsonb(new),coalesce(nullif(current_setting('shroom.import_source',true),''),'App edit'));
  end if;
  return new;
end; $$;
revoke all on function public.record_harvest_revision() from public, anon, authenticated;
grant execute on function public.record_harvest_revision() to service_role;
create function public.mark_harvest_weight_recorded() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
begin
  if nullif(current_setting('shroom.import_source',true),'') is null then
    if tg_op = 'INSERT' then
      new.fresh_weight_recorded := case when new.weight_kg > 0 then true else new.fresh_weight_recorded end;
      new.dry_weight_recorded := case when new.dry_weight_kg > 0 then true else new.dry_weight_recorded end;
    else
      if new.weight_kg is distinct from old.weight_kg then new.fresh_weight_recorded := true; end if;
      if new.dry_weight_kg is distinct from old.dry_weight_kg then new.dry_weight_recorded := true; end if;
    end if;
  end if;
  return new;
end; $$;
revoke all on function public.mark_harvest_weight_recorded() from public, anon, authenticated;
grant execute on function public.mark_harvest_weight_recorded() to service_role;
create trigger mark_harvest_weight before insert or update on public.harvests for each row execute function public.mark_harvest_weight_recorded();
create trigger harvest_revision after update on public.harvests for each row execute function public.record_harvest_revision();

create function public.archive_batches(p_ids bigint[], p_archived boolean) returns integer
language plpgsql security invoker set search_path = public, pg_temp as $$
declare b public.batches; changed integer := 0; stamp timestamptz; group_id uuid := gen_random_uuid();
begin
  if p_ids is null or cardinality(p_ids) not between 1 and 500 or p_archived is null then raise exception 'Select 1 to 500 batches'; end if;
  stamp := case when p_archived then now() else null end;
  if (select count(*) from public.batches where id = any(p_ids)) <> cardinality(p_ids) then raise exception 'Some batches no longer exist or IDs repeat'; end if;
  for b in select * from public.batches where id = any(p_ids) order by id for update loop
    if (b.archived_at is not null) = p_archived then continue; end if;
    update public.batches set archived_at = stamp where id = b.id;
    insert into public.batch_change_events(group_id,batch_id,batch_lot_code,action,before_state,after_state)
    values(group_id,b.id,b.lot_code,case when p_archived then 'Archived batch' else 'Restored batch' end,
      jsonb_build_object('archived_at',b.archived_at),jsonb_build_object('archived_at',stamp));
    changed := changed + 1;
  end loop;
  return changed;
end; $$;
revoke all on function public.archive_batches(bigint[],boolean) from public, anon, authenticated;
grant execute on function public.archive_batches(bigint[],boolean) to service_role;

create or replace function public.import_workbook(p_tables jsonb, p_source text, p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_table text; v_row jsonb; v_keys text[]; v_conflict text; v_columns text; v_select text;
  v_updates text; v_id bigint; v_counts jsonb := '{}'; v_count integer; v_ensure boolean;
  v_previous jsonb; v_harvest public.harvests;
  v_tables constant text[] := array['strains','vendors','equipment','customers','price_tiers','protocols',
    'reference_guides','issue_log','sourced_finished_goods','sales_log','batches','dry_inventory','harvests'];
begin
  if p_request_id is null or jsonb_typeof(p_tables) <> 'object' then raise exception 'Invalid workbook request'; end if;
  if exists(select 1 from jsonb_object_keys(p_tables) k where not k = any(v_tables)) then
    raise exception 'Unknown workbook section';
  end if;
  -- Serialize imports, and return the original receipt if a browser retries after a lost response.
  perform pg_advisory_xact_lock(731204091);
  select rows_upserted into v_previous from public.sheet_imports where request_id = p_request_id and status = 'ok';
  if found then return v_previous; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_tables->'harvests','[]')) r
    group by r->>'source_ref' having count(*) > 1) then raise exception 'Duplicate harvest IDs; assign a unique Harvest ID to each separate pick'; end if;
  for v_row in select value from jsonb_array_elements(coalesce(p_tables->'harvests','[]')) loop
    if coalesce(v_row->>'source_ref','') = '' then raise exception 'Harvest ID is required'; end if;
    if (v_row->>'weight_kg')::numeric < 0 or (v_row->>'dry_weight_kg')::numeric < 0 or
       (v_row->>'dry_weight_kg')::numeric > (v_row->>'weight_kg')::numeric then raise exception 'Invalid fresh/dry weights for %',v_row->>'source_ref'; end if;
    select * into v_harvest from public.harvests where source_ref = v_row->>'source_ref' for update;
    if found then
      if (v_harvest.weight_kg > 0 and (v_row->>'weight_kg')::numeric < v_harvest.weight_kg * 0.5) or
         (v_harvest.dry_weight_kg > 0 and (v_row->>'dry_weight_kg')::numeric < v_harvest.dry_weight_kg * 0.5) then
        raise exception 'Harvest % would lose more than half its recorded weight. Review/correct the harvest in the app before importing; no records changed',v_row->>'source_ref';
      end if;
      if v_row ? '_batch_lot_code' and not exists(select 1 from public.batches where id = v_harvest.batch_id and lot_code = v_row->>'_batch_lot_code') then
        raise exception 'Harvest ID % belongs to another batch',v_row->>'source_ref';
      end if;
      if v_row ? 'flush_number' and (v_row->>'flush_number')::integer <> v_harvest.flush_number then raise exception 'Harvest ID % belongs to another flush',v_row->>'source_ref'; end if;
    end if;
  end loop;
  perform set_config('shroom.import_source',left(p_source,255),true);

  foreach v_table in array v_tables loop
    if jsonb_typeof(coalesce(p_tables->v_table, '[]')) <> 'array' then raise exception 'Invalid workbook section %', v_table; end if;
    v_conflict := case v_table
      when 'strains' then 'name' when 'vendors' then 'name' when 'equipment' then 'name' when 'customers' then 'name'
      when 'price_tiers' then 'tier,product_class' when 'protocols' then 'name'
      when 'reference_guides' then 'guide_type,label' when 'issue_log' then 'log_date,issue'
      when 'sourced_finished_goods' then 'strain' when 'sales_log' then 'sale_date,buyer,strains,amount'
      when 'batches' then 'lot_code' when 'dry_inventory' then 'jar_id' when 'harvests' then 'source_ref' end;
    v_count := 0;
    for v_row in select value from jsonb_array_elements(coalesce(p_tables->v_table, '[]')) loop
      v_ensure := coalesce((v_row->>'_ensure_only')::boolean, false);
      v_row := v_row - '_ensure_only';
      if v_row ? '_strain_name' then
        select id into v_id from public.strains where lower(name) = lower(v_row->>'_strain_name') order by id limit 1;
        if not found then raise exception 'Unknown strain in %', v_table; end if;
        v_row := (v_row - '_strain_name') || jsonb_build_object('strain_id', v_id);
      end if;
      if v_row ? '_batch_lot_code' then
        select id into v_id from public.batches where lot_code = v_row->>'_batch_lot_code';
        if not found then raise exception 'Unknown batch in %', v_table; end if;
        v_row := (v_row - '_batch_lot_code') || jsonb_build_object('batch_id', v_id);
      end if;
      select array_agg(k order by k) into v_keys from jsonb_object_keys(v_row) k;
      if v_keys is null or v_keys && array['id','created_at','updated_at'] then raise exception 'Invalid import fields'; end if;
      -- Table names and conflict keys come only from the fixed allowlist above.
      -- Identifier quoting plus jsonb_populate_record keeps cell values out of SQL.
      select string_agg(format('%I', k), ','), string_agg(format('r.%I', k), ','),
        string_agg(format('%I = excluded.%I', k, k), ',')
        into v_columns, v_select, v_updates from unnest(v_keys) k;
      execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) r on conflict (%s)%s %s',
        v_table, v_columns, v_select, v_table, v_conflict,
        case when v_table = 'harvests' then ' where source_ref is not null' else '' end,
        case when v_ensure then 'do nothing' else 'do update set ' || v_updates end) using v_row;
      v_count := v_count + 1;
    end loop;
    v_counts := v_counts || jsonb_build_object(v_table, v_count);
  end loop;
  if (select coalesce(sum(value::integer),0) from jsonb_each_text(v_counts)) = 0 then raise exception 'No supported records found'; end if;
  insert into public.sheet_imports(source, status, rows_upserted, finished_at, request_id)
    values(left(p_source,255), 'ok', v_counts, now(), p_request_id)
    on conflict (request_id) do update set status = 'ok', rows_upserted = excluded.rows_upserted, finished_at = excluded.finished_at, detail = '';
  -- The request_id also completes the running row created by cloud dispatch.
  return v_counts;
end; $$;

revoke all on function public.import_workbook(jsonb,text,uuid) from public, anon, authenticated;
grant execute on function public.import_workbook(jsonb,text,uuid) to service_role;
