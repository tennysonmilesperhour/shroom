-- A lifecycle/room change, its history, and its export queue entry commit together.
create or replace function public.mutate_batch(
  p_batch_id bigint, p_kind text, p_stage text default null,
  p_room_id bigint default null, p_action text default null, p_group_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  b public.batches%rowtype;
  before_value jsonb;
  patch jsonb;
  target_stage text;
  action_text text;
  change_id bigint;
  stages text[] := array['colonization','spawn_to_bulk','fruiting','harvesting','spent'];
begin
  select * into strict b from public.batches where id = p_batch_id for update;
  if p_kind in ('stage','advance') then
    target_stage := case when p_stage = 'inoculation' then 'colonization' else p_stage end;
    if p_kind = 'advance' then
      target_stage := stages[array_position(stages, case when b.stage = 'inoculation' then 'colonization' else b.stage end) + 1];
      if target_stage is null then raise exception 'Batch is already at its final stage.'; end if;
    end if;
    if target_stage is null or not target_stage = any(stages) then raise exception 'Invalid lifecycle stage.'; end if;
    if (case when b.stage = 'inoculation' then 'colonization' else b.stage end) = target_stage then
      return jsonb_build_object('ok',true,'message','No change');
    end if;
    before_value := jsonb_build_object('stage',b.stage);
    patch := jsonb_build_object('stage',target_stage);
    if target_stage = 'colonization' and b.colonized_on is null then
      before_value := before_value || jsonb_build_object('colonized_on',null);
      patch := patch || jsonb_build_object('colonized_on',current_date);
    elsif target_stage = 'fruiting' and b.fruiting_on is null then
      before_value := before_value || jsonb_build_object('fruiting_on',null);
      patch := patch || jsonb_build_object('fruiting_on',current_date);
    elsif target_stage = 'spent' and b.spent_on is null then
      before_value := before_value || jsonb_build_object('spent_on',null);
      patch := patch || jsonb_build_object('spent_on',current_date);
    end if;
    action_text := coalesce(p_action, case when p_kind = 'advance' then 'Advanced to ' else 'Moved to ' end || target_stage);
    update public.batches set stage = target_stage,
      colonized_on = coalesce((patch->>'colonized_on')::date,b.colonized_on),
      fruiting_on = coalesce((patch->>'fruiting_on')::date,b.fruiting_on),
      spent_on = coalesce((patch->>'spent_on')::date,b.spent_on) where id = b.id;
  elsif p_kind = 'room' then
    if b.room_id is not distinct from p_room_id then return jsonb_build_object('ok',true,'message','No change'); end if;
    before_value := jsonb_build_object('room_id',b.room_id);
    patch := jsonb_build_object('room_id',p_room_id);
    action_text := coalesce(p_action,case when p_room_id is null then 'Removed room assignment' else 'Changed room' end);
    update public.batches set room_id = p_room_id where id = b.id;
  else raise exception 'Invalid batch action.';
  end if;
  insert into public.batch_change_events(group_id,batch_id,batch_lot_code,action,before_state,after_state)
    values(coalesce(p_group_id,gen_random_uuid()),b.id,b.lot_code,action_text,before_value,patch) returning id into change_id;
  insert into public.stage_events(batch_id,stage,room_id,note)
    values(b.id,case when p_kind = 'room' then 'moved' else target_stage end,
      case when p_kind = 'room' then p_room_id else b.room_id end,action_text);
  insert into public.sheet_sync_queue(entity,entity_id,op,payload) values('batch',b.id,'update',patch);
  return jsonb_build_object('ok',true,'message',action_text,'undoId',change_id);
end;
$$;

-- Lock the task before checking status: concurrent completion/retry advances once.
create or replace function public.complete_task(p_task_id bigint)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare t public.tasks%rowtype; result jsonb := '{}'::jsonb;
begin
  select * into strict t from public.tasks where id = p_task_id for update;
  if t.status = 'done' then return jsonb_build_object('ok',true,'message','Task already completed'); end if;
  if t.completion_action <> 'none' then
    if t.batch_id is null then raise exception 'This automation needs a linked batch.'; end if;
    result := public.mutate_batch(t.batch_id,
      case t.completion_action when 'advance_stage' then 'advance' when 'set_stage' then 'stage' when 'move_room' then 'room' else t.completion_action end,
      t.completion_stage,t.completion_room_id,'Completed task: ' || t.title);
  end if;
  update public.tasks set status = 'done',completed_at = now() where id = t.id;
  return result || jsonb_build_object('ok',true,'message',case when t.completion_action = 'none' then 'Task completed' else 'Task completed · batch record updated' end);
end;
$$;

-- Restore a whole group with locks and comparisons; a conflict rolls back all rows.
create or replace function public.undo_batch_change_group(p_change_id bigint)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  anchor public.batch_change_events%rowtype;
  event public.batch_change_events%rowtype;
  current_state jsonb;
  patch jsonb;
  key text;
  assignments text;
  restored bigint[] := array[]::bigint[];
  allowed text[] := array['stage','room_id','strain_id','container_type','container_id','tub_size','spawn_type','substrate_type','bag_type','block_count','substrate_weight_kg','inoculated_on','colonized_on','fruiting_on','spent_on','rating','contamination_flag','issues','notes'];
begin
  select * into strict anchor from public.batch_change_events where id = p_change_id;
  -- Every writer takes batch locks first, in ID order, then touches history.
  perform id from public.batches where id in (select batch_id from public.batch_change_events where group_id = anchor.group_id) order by id for update;
  for event in select * from public.batch_change_events where group_id = anchor.group_id order by id desc for update loop
    if event.undone_at is not null then raise exception 'That change was already undone.'; end if;
    if event.undo_expires_at < now() then raise exception 'The 10-minute undo window has expired.'; end if;
    if event.batch_id is null then raise exception 'Batch no longer exists.'; end if;
    select to_jsonb(b) into strict current_state from public.batches b where id = event.batch_id;
    for key in select jsonb_object_keys(event.after_state) loop
      if key = any(allowed) and (current_state->key) is distinct from (event.after_state->key) then
        raise exception '% changed again after this action, so it was not overwritten.',event.batch_lot_code;
      end if;
    end loop;
    select coalesce(jsonb_object_agg(k,v),'{}'::jsonb) into patch from jsonb_each(event.before_state) e(k,v) where k = any(allowed);
    select string_agg(format('%I = x.%I',k,k),',') into assignments from jsonb_object_keys(patch) k;
    if assignments is not null then
      execute format('update public.batches b set %s from jsonb_populate_record(null::public.batches,$1) x where b.id = $2',assignments) using patch,event.batch_id;
      insert into public.stage_events(batch_id,stage,note) values(event.batch_id,'undo','Undid: ' || event.action);
      insert into public.sheet_sync_queue(entity,entity_id,op,payload) values('batch',event.batch_id,'update',patch);
      restored := array_append(restored,event.batch_id);
    end if;
    update public.batch_change_events set undone_at = now() where id = event.id;
  end loop;
  return jsonb_build_object('ok',true,'message',case when cardinality(restored) = 1 then 'Change undone' else cardinality(restored)::text || ' batch changes undone' end,'batchIds',to_jsonb(restored));
end;
$$;

revoke all on function public.mutate_batch(bigint,text,text,bigint,text,uuid) from public,anon,authenticated;
revoke all on function public.complete_task(bigint) from public,anon,authenticated;
revoke all on function public.undo_batch_change_group(bigint) from public,anon,authenticated;
grant execute on function public.mutate_batch(bigint,text,text,bigint,text,uuid) to service_role;
grant execute on function public.complete_task(bigint) to service_role;
grant execute on function public.undo_batch_change_group(bigint) to service_role;
