# UI-check harness

Renders the whole app with representative fake data and screenshots every route
at mobile (390×844) and desktop (1440×900) widths, plus the interactions that
only exist after a click (add panels, edit dialogs, row menus). Use it before
shipping any UI change — see "UI checks on every update" in the repo CLAUDE.md.

No Supabase project or credentials required — nothing it does can touch real
data. `mock-supabase.mjs` emulates just enough PostgREST for the pages to
render: fixture rows per table/view, `.single()`, counts via `Content-Range`,
placeholder images for storage objects. Writes live in memory until the mock server restarts.

## Run it

From `web/`:

```bash
# 1. Mock backend (port 55321)
node scripts/ui-check/mock-supabase.mjs &

# 2. Python workbook API, also pointed at the mock (run in another terminal)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321 SUPABASE_SERVICE_ROLE_KEY=ui-check \
../.venv/bin/python api/workbook.py

# 3. App pointed at the mock (run in another terminal)
SHROOM_NEXT_DIST_DIR=.next-audit SHROOM_WORKBOOK_DEV_URL=http://127.0.0.1:3101 \
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55321 \
SUPABASE_SERVICE_ROLE_KEY=ui-check \
npm run dev &
timeout 60 bash -c 'until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done'

# 4. Sweep (writes PNGs to ./ui-check-shots/{mobile,desktop}/)
node scripts/ui-check/screenshot.mjs

# 5. Actual upload flows: preview/import, >4.5 MB photo, offline recovery, collection filter
UI_CHECK_BASE=http://localhost:3000 UI_CHECK_OUT=ui-check-shots/workflows \
node scripts/ui-check/workflows.mjs
```

Then open the screenshots for the pages you touched — mobile first. The sweep
prints any route that failed to render and any browser console errors.

A mobile screenshot **wider than 390px means the page scrolls sideways** — a
bug. Pinpoint the offending element with:

```bash
node scripts/ui-check/diagnose-overflow.mjs /route [/route2 ...]
```

The usual culprits: a grid/flex item missing `min-width: 0`, a `<select>`
whose longest option sets its width, or an unbreakable string (URL, lot code).

Environment knobs: `UI_CHECK_BASE` (app URL), `UI_CHECK_OUT` (output dir),
`UI_CHECK_CHROMIUM` (browser binary — defaults to `/opt/pw-browsers/chromium`,
the path used in Claude remote sessions), `MOCK_SUPABASE_PORT`.

## Keeping it honest

- New page → add the route to `ROUTES` in `screenshot.mjs`.
- New dialog/panel/menu → add a scenario to `SCENARIOS`.
- New table/view read by a page → add fixture rows to `fixtures.mjs`
  (the mock logs `no fixture for "<table>"` when a page reads something it
  doesn't know; the page then renders its empty state).
- Fixtures deliberately include a few over-long names/notes so overflow bugs
  show up in the screenshots — keep that property when editing them.

## Collection photography and contrast

Run `node scripts/ui-check/themes.mjs` with the same `UI_CHECK_BASE`,
`UI_CHECK_OUT`, and `UI_CHECK_CHROMIUM` settings. It clicks both collection
buttons, reloads to verify persistence, captures both light/dark themes at
390px and 1440px, and asserts at least 4.5:1 for primary, secondary, muted,
and faint text against the worst-case photograph pixel beneath the scrim.
It also checks the Functional selected-button contrast and page overflow.
