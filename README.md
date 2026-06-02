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

## 2. Five ideas for innovation

These go beyond what the incumbents ship today. Items marked ✅ are **already
implemented** in this codebase; the rest are designed-in extension points.

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
   `/analytics/recall/{lot_code}` forward-traces a lot → harvests → orders →
   customers in milliseconds (the 24-hour FDA requirement, met instantly). The
   same graph powers a QR "scan-to-see-provenance" experience for buyers.

---

## 3. How this improves on the existing `grow_ops.jsx` tool

The prior tool was a single-file React artifact with hardcoded `STRAINS`,
`HARVESTS`, and `ENV` arrays and an in-artifact Anthropic call. Shroom OS keeps its
spirit (and dark amber/earth theme, DM Mono + Syne) while closing its gaps:

| Gap in `grow_ops.jsx` | Fix in Shroom OS |
|---|---|
| **Static / hardcoded data** | Live REST API over a real database; the UI fetches everything |
| **No single source of truth** | One normalized schema is *the* source of truth (replaces the churning Word→Sheet→workbook sprawl) |
| **No persistence** | SQLite (swappable to Postgres via `SHROOM_DB_URL`); nothing lost on refresh |
| **Not multi-user / production-grade** | Stateless API ready for auth + multiple operators |
| **API key in the browser** | Advisor key lives **server-side** (`ANTHROPIC_API_KEY` env); context is assembled live per request, never hardcoded |
| Dry-ratio yellow-flag logic in JS | First-class `dry_ratio_pct` + `below_dry_floor` (7.5% rule) on every harvest, with a rollup report |
| Retail/distributor value estimate | Real `Product.price` + `distributor_price` and channel revenue analytics |

Carried over faithfully: strain cards (vendor / genetics / potency / ease / grow-again),
flush-by-flush harvests with fresh→dry ratios, environment targets-vs-actuals incl.
**FAE**, and the **AI advisor** (now hardened and live-context-driven).

---

## 4. Architecture

```
backend/app/
  database.py        SQLAlchemy engine/session (SQLite default, Postgres-ready)
  models.py          Domain model — cultivation, ops, business, traceability spine
  schemas.py         Pydantic v2 request/response contracts
  seed.py            Realistic Quantum Blue Mycology demo dataset
  main.py            FastAPI app; mounts /api routers + serves the SPA
  routers/
    cultivation.py   strains, recipes, rooms, batches, lifecycle, contamination
    environment.py   time-series readings + per-room compliance/alerts
    operations.py    staff, harvests, tasks, inventory, food-safety
    business.py      customers, products, multi-channel orders
    analytics.py     dashboard, yield, dry-ratio, recall, circular-economy, labor
    advisor.py       server-side AI advisor with live grow context
frontend/            no-build vanilla-JS dashboard (8 tabs)
tests/               12 end-to-end API tests
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
GET  /api/analytics/picker-productivity           labor lbs/hr (MycoSense-style)
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
| `SHROOM_ADVISOR_MODEL` | Advisor model id | `claude-sonnet-4-6` |
| `PORT` | Server port | `8000` |
