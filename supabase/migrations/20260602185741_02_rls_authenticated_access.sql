-- 02_rls_authenticated_access: lock every table to logged-in users.
-- anon/public get no policy => denied by default. Role-based policies
-- (owner / operator / picker) and multi-tenant org_id are the next layer.
do $$
declare t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists auth_all on public.%I', t);
    execute format(
      'create policy auth_all on public.%I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
