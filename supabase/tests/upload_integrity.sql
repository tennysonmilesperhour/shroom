begin;
do $$
declare
  v_strain bigint; v_batch bigint; v_photo bigint; v_id uuid := gen_random_uuid(); v_counts jsonb;
begin
  insert into public.strains(name,mushroom_type) values('AUDIT-ROLLBACK-Oyster','functional') returning id into v_strain;
  insert into public.batches(lot_code,strain_id) values('AUDIT-ROLLBACK-BATCH',v_strain) returning id into v_batch;
  select public.save_batch_media(jsonb_build_object('batch_id',v_batch,'storage_path','audit-rollback/photo.jpg',
    'original_filename','photo.jpg','mime_type','image/jpeg','byte_size',100,'stage_snapshot','colonization',
    'categories',jsonb_build_array('overview'),'captured_at',now(),'is_cover',true,'client_mutation_id',v_id)) into v_photo;
  perform public.save_batch_media(jsonb_build_object('batch_id',v_batch,'client_mutation_id',v_id));
  if (select count(*) from public.batch_media where batch_id=v_batch) <> 1 then raise exception 'Duplicate retry'; end if;
  begin
    perform public.save_batch_media(jsonb_build_object('batch_id',v_batch,'storage_path','audit-rollback/bad.jpg',
      'original_filename','bad.jpg','mime_type','image/jpeg','byte_size',100,'stage_snapshot','colonization',
      'categories',jsonb_build_array('invalid'),'captured_at',now(),'is_cover',true,'client_mutation_id',gen_random_uuid()));
    raise exception 'Expected invalid category failure';
  exception when check_violation then null;
  end;
  if not (select is_cover from public.batch_media where id=v_photo) then raise exception 'Lost original cover'; end if;
  begin
    perform public.import_workbook('{"strains":[{"name":"AUDIT-ROLLBACK-SHOULD-NOT-EXIST"}],"harvests":[{"_batch_lot_code":"AUDIT-NONEXISTENT"}]}'::jsonb,'Audit invalid file',gen_random_uuid());
    raise exception 'Expected invalid batch failure';
  exception when raise_exception then
    if sqlerrm <> 'Unknown batch in harvests' then raise; end if;
  end;
  if exists(select 1 from public.strains where name='AUDIT-ROLLBACK-SHOULD-NOT-EXIST') then raise exception 'Partial workbook import'; end if;
  if has_function_privilege('anon','public.import_workbook(jsonb,text,uuid)','execute') then raise exception 'Anonymous RPC access'; end if;
end; $$;
select 'Upload retry, cover rollback, import rollback, and RPC grants passed' as result;
rollback;
