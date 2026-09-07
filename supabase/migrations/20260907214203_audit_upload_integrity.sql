-- Atomic, retry-safe uploads. All functions follow Shroom's server-only access model.
alter table public.sheet_imports add column if not exists request_id uuid;
create unique index if not exists sheet_imports_request_id_key on public.sheet_imports(request_id);

create or replace function public.save_batch_media(p_media jsonb)
returns bigint language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_id bigint; v_batch bigint := (p_media->>'batch_id')::bigint;
begin
  perform 1 from public.batches where id = v_batch for update;
  if not found then raise exception 'Batch not found'; end if;
  select id into v_id from public.batch_media where client_mutation_id = (p_media->>'client_mutation_id')::uuid;
  if found then return v_id; end if;
  if coalesce((p_media->>'is_cover')::boolean, false) then
    update public.batch_media set is_cover = false where batch_id = v_batch and is_cover;
  end if;
  insert into public.batch_media(batch_id, storage_path, original_filename, mime_type, byte_size,
    stage_snapshot, categories, captured_at, note, is_cover, client_mutation_id)
  values(v_batch, p_media->>'storage_path', p_media->>'original_filename', p_media->>'mime_type',
    (p_media->>'byte_size')::bigint, p_media->>'stage_snapshot',
    array(select jsonb_array_elements_text(p_media->'categories')), (p_media->>'captured_at')::timestamptz,
    coalesce(p_media->>'note', ''), coalesce((p_media->>'is_cover')::boolean, false),
    (p_media->>'client_mutation_id')::uuid) returning id into v_id;
  return v_id;
end; $$;

create or replace function public.set_batch_cover(p_media_id bigint)
returns bigint language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_batch bigint;
begin
  select batch_id into v_batch from public.batch_media where id = p_media_id;
  if not found then raise exception 'Photo not found'; end if;
  perform 1 from public.batches where id = v_batch for update;
  update public.batch_media set is_cover = false where batch_id = v_batch and is_cover;
  update public.batch_media set is_cover = true where id = p_media_id and batch_id = v_batch;
  if not found then raise exception 'Photo no longer exists'; end if;
  return v_batch;
end; $$;

create or replace function public.import_workbook(p_tables jsonb, p_source text, p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_table text; v_row jsonb; v_keys text[]; v_conflict text; v_columns text; v_select text;
  v_updates text; v_id bigint; v_counts jsonb := '{}'; v_count integer; v_ensure boolean;
  v_previous jsonb;
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

revoke all on function public.save_batch_media(jsonb) from public, anon, authenticated;
revoke all on function public.set_batch_cover(bigint) from public, anon, authenticated;
revoke all on function public.import_workbook(jsonb,text,uuid) from public, anon, authenticated;
grant execute on function public.save_batch_media(jsonb) to service_role;
grant execute on function public.set_batch_cover(bigint) to service_role;
grant execute on function public.import_workbook(jsonb,text,uuid) to service_role;
alter function public.recall_trace(text) set search_path = public, pg_temp;
