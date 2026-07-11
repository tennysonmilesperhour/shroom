# 🍄 Shroom OS

**A full-scale mushroom grow-operation manager + business backend** — built to match
the industry standard of excellence and then push past it.

Modeled on the **Quantum Blue Mycology** operation (dual-track psychedelic +
functional cultivation, grain-bag-to-tub workflow), Shroom OS turns a polished but
*static* personal dashboard into a **persistent, multi-user, single-source-of-truth
backend** with a live web UI.

---

## Quick start

```bash
./setup.sh          # venv + deps + seeded demo database
./run.sh            # http://localhost:8000  (dashboard + API)
.venv/bin/python -m pytest tests/ -q   # 12 passing tests
```

API docs (auto-generated): `http://localhost:8000/docs`

---

## 1. Research: the three systems we mimic

After surveying the market, the "industry standard of excellence" isn't one product —
it's the **union of three tiers**. Shroom OS implements the best of each:

| # | System | Tier / strength | What we mirror |
|---|--------|-----------------|----------------|
| 1 | **MycoSense** (`mycosense.ch`) | Enterprise "Mushroom Farm Operating System," built with leading EU/NA commercial producers | Production forecasting, demand matching, **harvest & labor planning, picker productivity** (lbs/hr) |
| 2 | **Kinoko** (`kinoko-app.com`) | Mid-size farm ops | **Block/batch location tracking, per-room environmental history** (temp/CO₂/humidity), stage progression, yield projection, certification support |
| 3 | **Sporehubs / MycoFile / MycoHub** | SMB & prosumer cultivation trackers | **Inventory + low-stock alerts, strain/species library, multi-flush harvest logging, recipes & COGS,** tasks, QR labels, analytics |

Plus the **business backend** that wholesale buyers increasingly demand — customers,
multi-channel sales (wholesale / distributor / CSA / farmers-market / restaurant),
**FSMA-204 lot traceability & recall**, and **GAP / produce-safety logs**.

> Sources:
> [MycoSense](https://www.mycosense.ch/technology) ·
> [Kinoko](https://www.kinoko-app.com/) ·
> [Sporehubs](https://sporehubs.com/) ·
> [MycoFile](https://mycofile.app/) ·
> [MycoHub](https://www.fungisoft.xyz/) ·
> [Velosio / Dynamics 365 + SilverLeaf](https://www.velosio.com/market-focus/agribusiness/mushroom-farm-management-software/) ·
> [USDA Mushroom GAP](https://www.ams.usda.gov/services/auditing/gap-ghp/mushroom-gap) ·
> [FDA FSMA-204 Traceability Rule (21 CFR Part 1 Subpart S)](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-1/subpart-S) ·
> [Cornell Small Farms — mushroom markets](https://smallfarms.cornell.edu/projects/mushrooms/economics-and-markets/)

---

## 2. Innovation roadmap (10 ideas)

These go beyond what the incumbents ship today. Items marked ✅ are **already
implemented** (FastAPI reference and/or Supabase); the rest are designed-in
extension points. Ideas 6–10 are grounded in the Master Cultivation sheet data.

1. **Computer-vision contamination early-warning.**
   Phone-photo a block/tub; a vision model flags trichoderma / cobweb / wet-spot
   before it spreads and auto-opens a `ContaminationLog` + quarantine task. The
   `ContaminationLog.photo_url` field and `/contamination` endpoint are the hooks.

2. ✅ **Predictive yield / digital-twin forecasting.**
   `/analytics/batches/{id}/yield-forecast` projects remaining yield from each
   strain's biological-efficiency prior and flushes-so-far, with a rising
   confidence score — turning "how much will this lot make?" into a number.

3. ✅ **Spent-substrate circular-economy & carbon ledger.**
   `/analytics/circular-economy` quantifies spent mushroom substrate (SMS)
   available for compost / biochar / feed / secondary flush, with estimated
   CO₂e diverted and resale value — a new revenue line *and* an ESG story.

4. **Genetic genealogy & senescence alerts.**
   Strains carry self-referential lineage (`lineage_parent_id`, `generation`) and
   `/strains/{id}/lineage` walks the ancestry/descendant graph. Next step: score
   performance per generation and alert when a culture is senescing and should be
   re-cloned from an earlier, more vigorous node.

5. ✅ **One-click FSMA-204 recall + consumer provenance.**
   `/analytics/recall/{lot_code}` (and the Supabase `recall_trace(lot)` RPC)
   forward-traces a lot → harvests → orders → customers in milliseconds (the
   24-hour FDA requirement, met instantly). The same graph powers a QR
   "scan-to-see-provenance" experience for buyers.

6. ✅ **Live multi-tier inventory valuation.**
   `v_inventory_valuation` values every dried jar across wholesale / distributor
   / retail tiers in real time off `price_tiers` — replacing the sheet's manual
   valuation columns (J-01's 31.2 g → $94–156 / $218–250 / $374–468).

7. **Protocol-aware task automation.**
   Auto-generate the SOP checklists (Daily Environmental Check, Harvest Day,
   Dunk & Reset) as recurring, batch-scoped tasks straight from the `protocols`
   table — so the operator's hard-won routines run themselves.

8. **Lessons-grounded AI advisor (RAG).**
   Ground the advisor in the operation's own `reference_guides` + `issue_log`
   so it answers from lived history ("last time SG F2 stalled it was CO₂ — extend
   the tent opening and bump FAE") instead of generic mycology.

9. **Demand-driven production planner.**
   Read the sales-lead CRM (`customers.volume_est` + requested products, e.g.
   Greg the chef's LM/Reishi/Cordyceps ask) and back-solve how many bags/tubs of
   which strains to inoculate now to meet committed demand on time.

10. **Strain portfolio optimizer.**
    Rank the 19-strain library by realized biological-efficiency × dry-ratio ×
    ease × potency-tier price to turn the sheet's gut-feel "Grow Again? Y/N" into
    a data-driven keep/retire decision.

---

## 3. How this improves on the existing `grow_ops.jsx` tool

The prior tool was a single-file React artifact with hardcoded `STRAINS`,
`HARVESTS`, and `ENV` arrays and an in-artifact Anthropic call. Shroom OS keeps its
spirit (and dark amber/earth theme, DM Mono + Syne) while closing its gaps:

| Gap in `grow_ops.jsx` | Fix in Shroom OS |
|---|---|
| **Static / hardcoded data** | Live REST API over a real database; the UI fetches everything |
| **No single source of truth** | The canonical **`Master Cultivation Reference.xlsx`** is *the* source of truth; a live importer syncs it into both data stores (see below) |
| **No persistence** | SQLite (swappable to Postgres via `SHROOM_DB_URL`); nothing lost on refresh |
| **Not multi-user / production-grade** | Stateless API ready for auth + multiple operators |
| **API key in the browser** | Advisor key lives **server-side** (`ANTHROPIC_API_KEY` env); context is assembled live per request, never hardcoded |
| Dry-ratio yellow-flag logic in JS | First-class `dry_ratio_pct` + `below_dry_floor` (7.5% rule) on every harvest, with a rollup report |
| Retail/distributor value estimate | Real `Product.price` + `distributor_price` and channel revenue analytics |

Carried over faithfully: strain cards (vendor / genetics / potency / ease / grow-again),
flush-by-flush harvests with fresh→dry ratios, environment targets-vs-actuals incl.
**FAE**, and the **AI advisor** (now hardened and live-context-driven).

---

## 3b. Source of truth: the Master Cultivation Reference

The operation is driven from one canonical Excel workbook,
**`Master Cultivation Reference.xlsx`** (synced via Google Drive). A live
importer (`backend/app/sheet/`) parses every tab and **upserts it into both
stores** — the FastAPI/SQLite reference DB and the Supabase the web app reads —
so the sheet, not the code, is authoritative.

```bash
# Local copy -> FastAPI SQLite DB
python -m backend.app.sheet.importer --target sqlite --path "…/Master Cultivation Reference.xlsx"
# Google Drive -> live Supabase (also runs daily via GitHub Actions)
python -m backend.app.sheet.importer --target supabase
```

Imports are idempotent (upsert on natural keys / content hashes), so they can run
on a schedule. Full tab→table mapping: [`supabase/SHEET_MAPPING.md`](supabase/SHEET_MAPPING.md).

### Two-way sync — changes in the app flow back to the sheet

The sheet is no longer read-only to the app: the **Sheet Sync** view (and the
`/api/sync/*` endpoints) push the app's data *back* into the workbook, in the
same tab/column layout the importer reads — so it round-trips.

| Direction | Endpoint | What it does |
|-----------|----------|--------------|
| Sheet → App | `POST /api/sync/pull` | Import the workbook into the DB (the importer). |
| App → Sheet | `POST /api/sync/push` | **Non-destructive** keyed upsert of the owned tabs (Strain Library, Grow Cycle Log, Harvest Tracker, Buyers & Pricing): matching rows are updated in place, new ones appended, and operator-added rows/columns left untouched. |
| App → file | `GET /api/sync/workbook.xlsx` | Download the app's data as a Master-Reference-layout `.xlsx`. |
| status | `GET /api/sync/status` | Read/write config, plus **unsynced-change count** and last push/pull times so the UI can show how far behind the sheet is. |
| live | *(automatic)* | With `SHEET_SYNC_AUTO=1`, creating/updating an entity schedules a **debounced, coalesced** push — a burst of edits becomes one write. |

The push is a natural-key upsert, so it's safe to run repeatedly and never
duplicates rows or clobbers columns you maintain by hand on the sheet.

Three write backends are auto-selected from the environment (see
`backend/.env.example`), so the source of truth can be an **Excel `.xlsx`** (local
or on Drive) or a **native Google Sheet** (live, cell-level via the Sheets API):

* `MASTER_SHEET_GOOGLE_ID` → a Google Sheet (recommended for true two-way sync)
* `MASTER_SHEET_FILE_ID` → an `.xlsx` on Drive (download-modify-reupload)
* `MASTER_SHEET_PATH` → a local `.xlsx`

Writes need Google credentials with write scope (`drive` + `spreadsheets`);
reads work with a read-only token or a local file.

---

## 4. Architecture

```
backend/app/
  database.py        SQLAlchemy engine/session (SQLite default, Postgres-ready)
  models.py          Domain model — cultivation, ops, business, traceability spine
  schemas.py         Pydantic v2 request/response contracts
  seed.py            Realistic Quantum Blue Mycology demo dataset
  sheet/             Two-way sync: import (parse/sinks) + export (layout/export/writer) + autosync/state
  main.py            FastAPI app; mounts /api routers + serves the SPA
  routers/
    cultivation.py   strains, recipes, rooms, batches, lifecycle, contamination
    environment.py   time-series readings + per-room compliance/alerts
    operations.py    staff, harvests, tasks, inventory, food-safety
    business.py      customers, products, multi-channel orders
    analytics.py     dashboard, yield, dry-ratio, recall, circular-economy, labor
    advisor.py       server-side AI advisor with live grow context
    sync.py          two-way sheet sync: status / pull / push / download
frontend/            no-build vanilla-JS dashboard (9 tabs)
tests/               end-to-end API + sheet import/export tests
```

**Traceability spine:** `Strain → Batch(lot_code) → Harvest → OrderLine → Order →
Customer`. That single chain powers both the recall trace and per-strain yield
analytics.

### Key endpoints

```
GET  /api/analytics/dashboard                     executive KPIs
GET  /api/analytics/dry-ratio                     fresh/dry ratios + 7.5% flags
GET  /api/analytics/batches/{id}/yield-forecast   predictive yield (innovation #2)
GET  /api/analytics/recall/{lot_code}             FSMA-204 recall trace (innovation #5)
GET  /api/analytics/circular-economy              spent-substrate ledger (innovation #3)
GET  /api/analytics/supply-usage                  inferred burn of untracked supplies + replace-by
GET  /api/analytics/picker-productivity           labor lbs/hr (MycoSense-style)
GET  /api/stage-supply-estimates                  per-stage avg supply-usage estimates (CRUD)
GET  /api/environment/status                      room targets vs. latest + alerts
GET  /api/strains/{id}/lineage                    genetic genealogy (innovation #4)
POST /api/batches/{id}/advance                    move a lot through its lifecycle
POST /api/advisor/ask                             live-context AI grow advisor
```

### Configuration

| Env var | Purpose | Default |
|---|---|---|
| `SHROOM_DB_URL` | Database URL | `sqlite:///./shroom.db` |
| `ANTHROPIC_API_KEY` | Enables the live AI advisor (optional) | unset → advisor returns context only |
| `SHROOM_ADVISOR_MODEL` | Advisor model id | `claude-sonnet-4-5` |
| `PORT` | Server port | `8000` |
