-- Master Sheet is authoritative. Preserve the stale backlog without replaying it.
create table if not exists public.sheet_sync_discarded (
  queue_id bigint primary key,
  operation jsonb not null,
  discarded_at timestamptz not null default now(),
  reason text not null default 'Master Sheet migration; write-back disabled'
);
alter table public.sheet_sync_discarded enable row level security;
insert into public.sheet_sync_discarded(queue_id, operation)
select id, to_jsonb(q) from public.sheet_sync_queue q where synced_at is null
on conflict (queue_id) do nothing;
delete from public.sheet_sync_queue q using public.sheet_sync_discarded d
where q.id = d.queue_id and q.synced_at is null;
-- Database workflows also enqueue directly. Disable that path during rebuild.
create or replace function public.disable_sheet_queue() returns trigger
language plpgsql set search_path = public as $$
begin
  return null;
end;
$$;
create trigger master_sheet_read_only before insert on public.sheet_sync_queue
for each row execute function public.disable_sheet_queue();
