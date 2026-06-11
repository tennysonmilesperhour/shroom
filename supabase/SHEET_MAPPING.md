# Master Cultivation Reference → Shroom OS

The **single source of truth** is the canonical Excel workbook
**`Master Cultivation Reference.xlsx`** (Quantum Blue Mycology · Isaac Childs),
maintained in the synced *Mushrooms* Google Drive folder
([file](https://drive.google.com/file/d/1KJSAauzZ-CBpA1f4hDISsLzAiFnoh4jC/view)).
It supersedes every earlier sheet/workbook that was previously transcribed by
hand into the seed data — those are no longer authoritative.

Unlike before, the sheet is **no longer a read-only reference we mirror once**:
a live importer (`backend/app/sheet/`) parses the workbook and **upserts every
tab into both data stores** — the FastAPI/SQLite reference DB and the Supabase
the web app reads — so editing the sheet updates the app.

## Running the importer

```bash
# From a local copy of the workbook into the FastAPI SQLite DB:
python -m backend.app.sheet.importer --target sqlite \
    --path "~/Mushrooms/Master Cultivation Reference.xlsx"

# From Google Drive into the live Supabase (unattended):
GOOGLE_OAUTH_TOKEN=… NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
    python -m backend.app.sheet.importer --target supabase
```

The source resolves in priority order: `--path` / `MASTER_SHEET_PATH`, then a
Google Drive download of `MASTER_SHEET_FILE_ID` (default is the canonical file)
using a service-account key (`GOOGLE_SERVICE_ACCOUNT_JSON`, recommended) or a
short-lived `GOOGLE_OAUTH_TOKEN`. Every run is recorded in `public.sheet_imports`.

### The "Sync from sheet" button

The sync is **manual, one-click**: the `/sync` page has a **Sync from sheet**
button that triggers the importer's GitHub Actions workflow
(`.github/workflows/sheet-import.yml`) via workflow-dispatch. The button greys
out (“✓ Synced today”) once it's been run for the day and re-enables tomorrow.
Wiring it up needs:

- **Web app** (Vercel env): `GITHUB_DISPATCH_TOKEN` (fine-grained PAT, Actions
  read+write), optionally `GITHUB_REPO` / `GITHUB_SYNC_REF`.
- **GitHub repo secrets**: `GOOGLE_SERVICE_ACCOUNT_JSON` (workbook shared to the
  SA email, read-only), `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

Imports are **idempotent**: each table upserts on a natural key (declared in
migration `15_master_sheet_import.sql`), so re-running updates rows in place
instead of duplicating them. The append-only tabs upsert on a natural composite
key — Sales Log on `(sale_date, buyer, strains, amount)`, Incident Log on
`(log_date, issue)`.

## Tab → table mapping

| Sheet tab | Supabase / SQLite target | Upsert key |
|---|---|---|
| Environment (equipment) | `equipment` | `name` |
| Strain Library + Fridge & Incoming | `strains` (both) | `name` |
| Jar Inventory | `dry_inventory` | `jar_id` |
| Jar Inventory → *Pricing Reference* | `price_tiers` | `tier, product_class` |
| Sourced Finished Goods | `sourced_finished_goods` *(new)* | `strain` |
| Sales Log | `sales_log` *(new)* | `sale_date, buyer, strains, amount` |
| Harvest Tracker | `harvests` (both) | `source_ref` (lot code) |
| Grow Cycle Log | `batches` (both) | `lot_code` |
| Buyers & Pricing | `customers` (both) | `name` |
| Vendors (+ Chaga sourcing leads) | `vendors` | `name` |
| Protocols | `protocols` | `name` |
| Troubleshooting → guide + symptom | `reference_guides` | `guide_type, label` |
| Troubleshooting → incident log | `issue_log` | `log_date, issue` |

The FastAPI/SQLite store has a coarser model, so it receives the subset its
schema represents: **strains, customers, and the batch → harvest cultivation
spine**. Supabase, whose schema was built for these tabs, receives all of them.

## Deliberate normalizations (kept from the model)

- **Units:** the sheet is °F / grams; harvest weights are stored in kg
  (`weight_kg`) and the app localizes back to the operator's gram/°F view.
- **Ease rating** keeps the sheet's `/10` convention (`'9/10'` → `9`); a
  non-numeric ease (`'Moderate'`) leaves the column default.
- **Traceability spine** (`Strain → Batch → Harvest → OrderLine → Order →
  Customer`) and **RLS** are model features with no sheet column — preserved.
- A grow-cycle row's `(tub, flush)` becomes the synthesized **lot code**
  (`T-01-F1`) that links a batch to its harvest across both stores.
