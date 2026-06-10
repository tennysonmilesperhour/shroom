-- 14_truth_sources - registry for embedded live data sources ("Truth Source").
--
-- The operator keeps canonical working data in Google Sheets. Rather than copy
-- those numbers into the app by hand, they register each sheet here once; the
-- Truth Source tab then renders every registered sheet as a live, auto-
-- refreshing embed. Adding or removing a row adds/removes a live data input
-- that anyone in the app can see in one place.
--
-- Only the original share/publish URL is stored; the embeddable form is derived
-- at render time (see web/lib/sheets.ts) so a paste of any Google Sheets link
-- just works.

create table if not exists public.truth_sources (
  id          bigint generated always as identity primary key,
  label       text not null,
  url         text not null,                       -- original Google Sheets URL
  category    text not null default 'general',
  notes       text,
  position    integer not null default 0,          -- manual ordering, low = first
  height      integer not null default 540         -- embed height in px
              check (height between 160 and 2000),
  created_at  timestamptz not null default now()
);

create index if not exists truth_sources_order_idx
  on public.truth_sources (position, created_at);

alter table public.truth_sources enable row level security;
drop policy if exists auth_all on public.truth_sources;
create policy auth_all on public.truth_sources
  for all to authenticated using (true) with check (true);
