-- 14_dashboard_routines - operator-programmable command center.
--
-- The dashboard lets an operator "program" recurring work: daily tasks,
-- check-ins, automations, and reports. Each routine carries a target href so
-- the dashboard row is a one-click jump to the page where the operator acts
-- (e.g. an "Environment check-in" links to /environment). `last_done_at` is
-- stamped when the operator marks the routine done; the dashboard derives a
-- "due" state from it relative to the cadence, so nothing here needs a cron.

create table if not exists public.routines (
  id          bigint generated always as identity primary key,
  kind        text not null
                check (kind in ('task', 'check_in', 'automation', 'report')),
  title       text not null,
  cadence     text not null default 'daily'
                check (cadence in ('daily', 'weekly', 'monthly', 'as_needed')),
  href        text not null default '/',
  notes       text not null default '',
  active      boolean not null default true,
  sort_order  int not null default 0,
  last_done_at timestamptz,
  created_at  timestamptz not null default now()
);

-- Dashboard renders active routines grouped by kind, ordered for the operator.
create index if not exists routines_active_idx
  on public.routines (kind, sort_order, created_at)
  where active;

alter table public.routines enable row level security;
drop policy if exists auth_all on public.routines;
create policy auth_all on public.routines
  for all to authenticated using (true) with check (true);

-- Starter set so the command center is useful on first load. Each row maps to
-- a real page the operator already has, demonstrating the click-through. Seeded
-- once; re-running the migration won't duplicate (guarded by the not-exists).
insert into public.routines (kind, title, cadence, href, notes, sort_order)
select v.kind, v.title, v.cadence, v.href, v.notes, v.sort_order
from (values
  ('task',       'Walk the grow rooms',       'daily',    '/batches',       'Eyes on every active block.',          10),
  ('task',       'Log today''s harvests',     'daily',    '/harvests',      'Weigh fresh + dry, record the flush.', 20),
  ('check_in',   'Environment check-in',      'daily',    '/environment',   'Confirm every room is in spec.',       10),
  ('check_in',   'Contamination scan',        'daily',    '/contamination', 'Flag and isolate anything suspect.',   20),
  ('automation', 'Push pending sheet sync',   'daily',    '/sync',          'Flush website changes to the sheet.',  10),
  ('report',     'Review the yield report',   'weekly',   '/reports',       'Yield by strain + bio-efficiency.',    10),
  ('report',     'Ask the advisor',           'weekly',   '/advisor',       'Surface anomalies worth acting on.',   20)
) as v(kind, title, cadence, href, notes, sort_order)
where not exists (select 1 from public.routines);
