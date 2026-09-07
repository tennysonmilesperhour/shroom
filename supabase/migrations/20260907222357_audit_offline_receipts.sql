-- Persist offline receipt IDs so a lost response cannot replay over a newer edit.
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
  prior_action text;
  stages text[] := array['colonization','spawn_to_bulk','fruiting','harvesting','spent'];
begin
  select * into strict b from public.batches where id = p_batch_id for update;
  if p_group_id is not null then
    select id,action into change_id,prior_action from public.batch_change_events
      where batch_id = p_batch_id and group_id = p_group_id order by id limit 1;
    if found then return jsonb_build_object('ok',true,'message','Update already synced','undoId',change_id); end if;
  end if;
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

