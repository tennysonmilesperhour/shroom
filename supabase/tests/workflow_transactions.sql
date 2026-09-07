begin;
do $$
declare
  s bigint; b bigint; t bigint; result jsonb; change_id bigint;
  group_key uuid := gen_random_uuid(); second_batch bigint; stage_before text;
begin
  insert into public.strains(name,mushroom_type) values('AUDIT-WORKFLOW-' || gen_random_uuid(),'functional') returning id into s;
  insert into public.batches(lot_code,strain_id,stage) values('AUDIT-WORKFLOW-' || gen_random_uuid(),s,'colonization') returning id into b;
  insert into public.tasks(title,batch_id,completion_action) values('Audit completion',b,'advance_stage') returning id into t;
  result := public.complete_task(t);
  change_id := (result->>'undoId')::bigint;
  perform public.complete_task(t);
  if (select stage from public.batches where id=b) <> 'spawn_to_bulk' then raise exception 'Task advanced twice'; end if;
  if (select count(*) from public.batch_change_events where batch_id=b) <> 1 then raise exception 'Duplicate task history'; end if;
  if (select count(*) from public.sheet_sync_queue where entity='batch' and entity_id=b) <> 1 then raise exception 'Missing queue record'; end if;
  perform public.undo_batch_change_group(change_id);
  if (select stage from public.batches where id=b) <> 'colonization' then raise exception 'Undo did not restore stage'; end if;

  insert into public.tasks(title,batch_id,completion_action,completion_stage) values('Audit invalid stage',b,'set_stage','invalid') returning id into t;
  begin
    perform public.complete_task(t);
    raise exception 'Expected stage validation failure';
  exception when raise_exception then
    if sqlerrm <> 'Invalid lifecycle stage.' then raise; end if;
  end;
  if (select status from public.tasks where id=t) <> 'open' then raise exception 'Invalid task partially completed'; end if;

  insert into public.batches(lot_code,strain_id,stage) values('AUDIT-WORKFLOW-' || gen_random_uuid(),s,'colonization') returning id into second_batch;
  result := public.mutate_batch(b,'stage','fruiting',null,null,group_key);
  change_id := (result->>'undoId')::bigint;
  perform public.mutate_batch(second_batch,'stage','fruiting',null,null,group_key);
  perform public.mutate_batch(b,'stage','harvesting');
  begin
    perform public.undo_batch_change_group(change_id);
    raise exception 'Expected newer edit conflict';
  exception when raise_exception then
    if position('changed again after this action' in sqlerrm) = 0 then raise; end if;
  end;
  if (select stage from public.batches where id=second_batch) <> 'fruiting' then raise exception 'Group partially undone'; end if;
  if exists(select 1 from public.batch_change_events where group_id=group_key and undone_at is not null) then raise exception 'Group partially marked undone'; end if;
  group_key := gen_random_uuid();
  perform public.mutate_batch(b,'stage','fruiting',null,null,group_key);
  perform public.mutate_batch(b,'stage','harvesting');
  perform public.mutate_batch(b,'stage','fruiting',null,null,group_key);
  if (select stage from public.batches where id=b) <> 'harvesting' then raise exception 'Lost-response retry overwrote a newer edit'; end if;
  if (select count(*) from public.batch_change_events where batch_id=b and group_id=group_key) <> 1 then raise exception 'Duplicate offline receipt'; end if;
  if has_function_privilege('anon','public.complete_task(bigint)','execute') then raise exception 'Anonymous workflow access'; end if;
end; $$;
select 'Task retry, transactional history/queue, undo, failure rollback, grouped conflict and grants passed' as result;
rollback;
