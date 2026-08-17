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

## UI checks on every update — desktop AND mobile

Isaac's client uses the web app heavily **from a phone**. Any change that touches
UI (`web/app/**`, `web/components/**`, `globals.css`) must be **looked at, not just
built**, at both widths before it ships:

- Run the UI-check harness (`web/scripts/ui-check/README.md`): it starts the app
  against a mock Supabase with representative data and screenshots **every route at
  390px and 1440px**, plus the add-panel / edit-dialog / row-menu interactions.
- Actually open the screenshots for the pages you touched (mobile first) and check:
  nothing clipped or overflowing horizontally, forms and dialogs usable, touch
  targets not cramped, sticky action columns behaving.
- New UI = add a route or interaction scenario to `screenshot.mjs` so the harness
  keeps covering it.

Don't rely on `npm run build` passing as proof a UI change works — it compiles,
it doesn't render.

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
