-- Stage-timing baselines.
--
-- Durations themselves are derived from stage_events and the batch date
-- columns, so nothing here duplicates them. These tables hold what only the
-- operator can supply:
--   stage_timing_notes      the answer to "this step ran unusually long/short,
--                           did anything change?" (and which parameters)
--   stage_timing_automation per-strain switches for alerts / label printing,
--                           which the app only allows once confidence is high.

create table if not exists public.stage_timing_notes (
  id bigint generated always as identity primary key,
  batch_id bigint not null references public.batches(id) on delete cascade,
  from_stage text not null,
  to_stage text,
  observed_days int not null,
  expected_days numeric not null,
  direction text not null check (direction in ('slow', 'fast')),
  response text not null check (response in ('changed', 'unchanged', 'dismissed')),
  factors text[] not null default '{}',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One answer per stage a batch spent time in.
  unique (batch_id, from_stage)
);

create index if not exists stage_timing_notes_batch_idx
  on public.stage_timing_notes(batch_id);

create table if not exists public.stage_timing_automation (
  strain_id bigint primary key references public.strains(id) on delete cascade,
  alerts_enabled boolean not null default false,
  labels_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

-- Server-only, like the other workflow tables: the app talks to these with its
-- service-role client.
grant select, insert, update, delete on table
  public.stage_timing_notes,
  public.stage_timing_automation
to service_role;

revoke all on table
  public.stage_timing_notes,
  public.stage_timing_automation
from anon, authenticated;

grant usage, select on sequence public.stage_timing_notes_id_seq to service_role;
revoke all on sequence public.stage_timing_notes_id_seq from anon, authenticated;

alter table public.stage_timing_notes enable row level security;
alter table public.stage_timing_automation enable row level security;
