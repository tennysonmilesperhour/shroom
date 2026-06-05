-- 12_sheet_sync_queue - durable infrastructure for the Sheets bridge.
--
-- The website is the system of record going forward. Operators can input
-- directly through the UI; every insert/update enqueues a pending op here.
-- An external worker (or eventually a button-triggered server action) will
-- read pending ops, push them to the Google Sheet, and mark them synced.
--
-- The reverse direction (sheet -> website) is handled externally; this
-- table only tracks website-originated changes that need to flow up.

create table if not exists public.sheet_sync_queue (
  id            bigint generated always as identity primary key,
  entity        text not null,        -- 'vendor' | 'supply' | 'customer' | etc.
  entity_id     bigint not null,      -- row id in the source table
  op            text not null         -- 'insert' | 'update' | 'delete'
                check (op in ('insert', 'update', 'delete')),
  payload       jsonb not null default '{}'::jsonb,
  synced_at     timestamptz,
  created_at    timestamptz not null default now(),
  source        text not null default 'web'
);

create index if not exists sheet_sync_queue_pending_idx
  on public.sheet_sync_queue (created_at)
  where synced_at is null;

alter table public.sheet_sync_queue enable row level security;
drop policy if exists auth_all on public.sheet_sync_queue;
create policy auth_all on public.sheet_sync_queue
  for all to authenticated using (true) with check (true);
