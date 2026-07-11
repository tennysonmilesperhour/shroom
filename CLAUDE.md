# Shroom OS — working agreement

Isaac runs this operation **solo**. Pick up the engineering-process side of things
so he doesn't have to prompt for it.

## Drive PRs to `main` autonomously

Default to owning the whole path from *change → merged on `main`* without being asked.
Once work is pushed and a PR is open, **see it through to merge yourself**:

- **Keep CI green.** When a check fails, diagnose it, fix it, push, and re-check —
  don't just report the failure and stop. Re-kick until it's green or you hit a
  genuine blocker, then explain the blocker.
- **Handle review comments.** Apply the fix and resolve the thread when it's clear;
  ask first only when a change is genuinely ambiguous or architecturally significant.
- **Keep the branch current** with `main` (rebase/merge) if it falls behind, and
  resolve merge conflicts.
- **Merge when mergeable.** CI green + no unresolved review threads + no conflicts →
  mark the PR ready (if draft), **squash-merge it, and delete the branch**. No need
  to ask first.
- **Clean up after merge.** Unsubscribe from PR activity and cancel any self-check-in
  timers tied to that PR.

Because webhooks don't deliver CI *success*, new pushes, or merge-conflict transitions,
keep a periodic self-check-in armed while a PR is open so it actually reaches `main`
rather than stalling silently.

## When to pause and ask

Only stop for explicit sign-off when a change is **destructive, outward-facing, or
something Isaac has said he wants to review first** (e.g. schema-destroying
migrations, deleting data, anything that ships to customers). Otherwise assume
"get it to `main`" is the standing goal.

## Project basics

- Backend: FastAPI + SQLAlchemy under `backend/app/` (reference store, SQLite via `SHROOM_DB_URL`).
- Web app: Next.js under `web/` (reads Supabase); Supabase schema in `supabase/migrations/`.
- Static dashboard: `frontend/` (no build), served by the FastAPI app.
- Tests: `.venv/bin/python -m pytest tests/ -q` — keep them green; add coverage with new features.
- The **Master Cultivation Reference** sheet is the source of truth; the `backend/app/sheet/` importer syncs it into both stores.
