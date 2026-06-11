-- 14_feedback_notes: in-app beta feedback / side notes.
--
-- Every page carries a "Side notes" drawer where the beta user can file a
-- note tied to the page they're on. The dev polls these for near-real-time
-- visibility into what the user wants next. Page + label are captured from
-- the client so each note records which screen it came from.

create table if not exists public.feedback (
  id          bigint generated always as identity primary key,
  page        text not null default '',          -- pathname the note was filed from
  page_label  text not null default '',          -- human label, e.g. "Batches"
  body        text not null,
  status      text not null default 'open'
              check (status in ('open', 'done')),
  created_at  timestamptz not null default now()
);

create index if not exists feedback_recent_idx
  on public.feedback (created_at desc);
create index if not exists feedback_open_idx
  on public.feedback (created_at desc)
  where status = 'open';

alter table public.feedback enable row level security;
drop policy if exists auth_all on public.feedback;
create policy auth_all on public.feedback
  for all to authenticated using (true) with check (true);
