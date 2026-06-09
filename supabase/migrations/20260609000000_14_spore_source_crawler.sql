-- 14_spore_source_crawler: weekly sourcing crawler for unknown-source strains.
--
-- A strain's `strains.library_status` may now be set to 'unknown', meaning the
-- operator has no trusted in-house source for that genetic. The weekly crawler
-- (Vercel Cron -> /api/cron/spore-crawl) scans the tracked spore/genetics
-- vendors for pages that mention the strain and carry an in-stock buy signal,
-- and records what it finds here. Nothing existing is dropped or renamed; this
-- is purely additive. `library_status` stays free text (no enum) so 'unknown'
-- needs no DDL beyond this documentation.

-- One row per crawl execution, for observability of the scheduled job.
create table if not exists public.spore_crawl_runs (
  id              bigint generated always as identity primary key,
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  strains_checked int not null default 0,
  listings_found  int not null default 0,           -- in-stock listings discovered
  status          text not null default 'running',  -- running / ok / error
  detail          text not null default ''
);

-- Point-in-time "this vendor currently has this strain" findings. Each weekly
-- run replaces the prior listings for the strains it checks.
create table if not exists public.spore_source_listings (
  id            bigint generated always as identity primary key,
  strain_id     bigint not null references public.strains(id) on delete cascade,
  vendor_name   text not null default '',
  source_url    text not null default '',
  product_title text not null default '',
  in_stock      boolean not null default false,
  price         text not null default '',
  found_at      timestamptz not null default now(),
  crawl_run_id  bigint references public.spore_crawl_runs(id) on delete set null,
  notes         text not null default ''
);

create index if not exists spore_source_listings_strain_idx
  on public.spore_source_listings (strain_id, in_stock);

-- Re-apply RLS + the authenticated-access policy to the new tables, matching
-- the pattern used by every other table in this schema.
do $$
declare t text;
begin
  for t in
    select unnest(array['spore_crawl_runs', 'spore_source_listings'])
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists auth_all on public.%I', t);
    execute format(
      'create policy auth_all on public.%I for all to authenticated using (true) with check (true)', t);
  end loop;
end $$;
