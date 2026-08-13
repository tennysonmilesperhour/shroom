-- Reconcile a production-only protocol RPC overload with the new task
-- completion automation. Keeping both overloads makes two-argument PostgREST
-- calls ambiguous because the four-argument version supplies defaults.

drop function if exists public.generate_protocol_tasks(bigint, bigint);

create or replace function public.generate_protocol_tasks(
  p_protocol_id bigint,
  p_batch_id bigint default null,
  p_assigned_to bigint default null,
  p_due date default current_date
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
      title, description, batch_id, assigned_to, due_date, status, priority,
      completion_action, completion_stage
    ) values (
      v_step, 'SOP: ' || coalesce(v_name, ''), p_batch_id, p_assigned_to,
      p_due, 'open', 'med', v_action, v_stage
    );
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.generate_protocol_tasks(bigint, bigint, bigint, date)
  from anon, authenticated, public;
grant execute on function public.generate_protocol_tasks(bigint, bigint, bigint, date)
  to service_role;

-- These tables are server-only: browser roles have no table grants, and this
-- explicit policy documents the intended RLS boundary for database advisers.
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
    execute format('drop policy if exists server_only on public.%I', t);
    execute format(
      'create policy server_only on public.%I for all to service_role using (true) with check (true)',
      t
    );
  end loop;
end $$;
