# Shroom OS — Repository Audit, Competitive Plan & Opus 4.8 Handoffs

_Prepared 2026-07-07. Scope: the production product (Next.js 15 + Supabase web app in `/web` + `/supabase`). The FastAPI/SQLite stack in `/backend` + `/frontend` is treated as a legacy reference (see §1.2)._

---

## Part 1 — The Report: where it actually stands

### 1.1 Headline verdict

This is a **strong, genuinely-authored product with an exceptional design foundation** that is being held back by three fixable things: (1) the cross-linked navigation flow you care most about is only ~30% built, (2) manual data entry has a structural integrity bug where the *create* form and the *edit* form for the same record disagree, and (3) there is no authentication at all. None of these require a rewrite. The bones are top ~5% for an operations tool; the work is consolidation and completion, not reinvention.

Think of the current state as a beautifully furnished house where about two-thirds of the interior doors are painted onto the walls. The rooms are gorgeous. You just can't walk between them yet.

### 1.2 Architecture reality check

There are **two independent backends** in this repo, and only one is real:

| Stack | Location | Status |
|---|---|---|
| **Next.js 15 + Supabase** | `/web`, `/supabase` | **Production.** What CI builds, what Vercel deploys, the full ~40-table schema, all recent commits. |
| FastAPI + SQLite + vanilla-JS SPA | `/backend`, `/frontend`, `shroom.db` | **Legacy reference.** Zero runtime coupling to the web app (no `localhost:8000`/`fastapi`/`backend` references anywhere in `/web`). A coherence liability — recall logic, biological-efficiency math, and stage vocabulary now live in two places that must be kept in sync by hand. |

**Recommendation:** archive or delete `/backend`, `/frontend`, and the committed `shroom.db`. They are dead weight and a trap for future contributors. The only thing worth preserving is the Python sheet importer (`backend/app/sheet/`), which the GitHub Action still uses — extract it to a top-level `/importer` so it isn't entangled with the dead demo.

### 1.3 What's genuinely excellent (protect these)

- **A real design system, hand-authored.** No Tailwind — a 3,173-line `globals.css` built on OKLCH color tokens, a fluid `clamp()` type scale, an 8pt spacing rhythm, and named easing curves. Fully re-authored light theme (not an inverted palette), with WCAG AA contrast targets written into the comments.
- **A meaningful ambient/motion layer.** `OperationPulse` publishes live operation vitals onto `<html>` so the background literally breathes faster when the operation is busy and washes amber when a room is out of spec. `QuantumBackground`, `AlkaloidSpectrum` (an honest lab-vs-anecdotal polar chart), and `LifecycleRing` are best-in-class for this niche. Every effect is `prefers-reduced-motion`-aware (14 separate CSS blocks + a hook) and SSR-safe.
- **Accessibility well above average.** Focus-trapped mobile drawer, skip link, `:focus-visible` rings, `scope`/`caption`/aria on tables and gauges, `aria-current` nav.
- **Good information architecture.** Nav is grouped Grow → Sell → Source → Comply → Intelligence from a single shared source (`web/lib/nav.ts`) that both desktop and mobile consume, so they can't drift. A working ⌘K command palette indexes strains/batches/customers/orders.
- **The batch detail page (`web/app/(app)/batches/[id]/page.tsx`) is the gold standard.** It links out to strain, room, customers, and harvest labels, and pulls in downstream orders. **Every other detail page should be built to match it.**
- **Sound data access.** Server-side (RSC) reads via PostgREST embedded joins, `Promise.all` parallelism, no N+1s. A single `recall_trace()` RPC does forward traceability in one call.

### 1.4 The gaps, grouped by the thing you asked about

#### A. Cross-linked navigation flow (your #1 priority) — ~30% built

- **Only 3 of 23 entities have a detail page** (strain, batch, customer). The other 20 routes are drill-in dead-ends.
- **Orders are a black hole.** There is no order detail page, so an order number renders as plain bold text in at least three places (orders list, customer order-history, batch "downstream orders" links to the *list* not the order). You can go order → customer, but never *into* an order.
- **Harvests have no page but are the traceability pivot** (batch ↔ order line ↔ label). Every harvest reference across the app is un-clickable text.
- **The entire Source group is unlinked.** Vendors ⇄ purchase-orders ⇄ supplies have zero internal cross-links.
- **Links are asymmetric.** The orders *list* links customers, but the customer *detail* order-history does not link back to orders — drilling in hits a wall.
- **No breadcrumbs, no context-aware back.** Each detail page has one hardcoded "← Back to list" that ignores how you arrived. Arriving at a strain from a batch still says "← Strain library," losing the trail.
- **No URL state for filters/tabs.** `useSearchParams` is used zero times. No filtered view is shareable, refresh-safe, or restorable with the back button. Segmented tabs and board filters live in React state only.
- **Command palette blind spots.** It doesn't index harvests, vendors, POs, or tasks, and order hits dump you on the list.

#### B. Manual data entry (your #2 priority) — works, but inconsistent and incomplete

- **The keystone bug: create and edit disagree.** Create forms (bespoke `Add*Form.tsx`) and the edit registry (`web/lib/entities.ts`) are authored separately and have drifted. Concretely:
  - **Orders:** create uses channels `retail/wellness/market/online` and sets payment + fulfillment status; edit uses *different* channels `csa/farmers_market/restaurant/dtc` and exposes no payment status at all. Payment status you set on create **cannot be edited**.
  - **Strains:** create collects `target_temp_f`, `target_humidity`, `target_co2_ppm`, `priority` — **none exist in the edit registry**, so they're uneditable after creation.
  - **Customers** and **contamination** have the same class of divergence (contamination create offers a curated type dropdown + photo URL; edit downgrades type to freetext and drops the photo).
  - Net effect: data you type one way can't be corrected the other way. This is the opposite of "intuitive manual input."
- **No typeahead anywhere.** Every foreign-key picker is a plain native `<select>`. Fine at demo scale; unusable once strains/customers/batches grow past a screen.
- **No inline "add a related record."** You can't create a vendor while writing a PO, or a customer while writing an order — you must abandon the form, navigate away, and come back.
- **Silent numeric coercion.** Blank/invalid numbers are replaced with fabricated defaults (ease→3, humidity→90, CO₂→800) with no warning, so an operator can save invented values.
- **Raw Postgres errors reach the user.** A duplicate lot code shows "duplicate key value violates unique constraint …" in a toast.
- **Create gaps.** No manual create at all for: tasks, products (catalog), campaigns (marketing), food-safety logs, subscriptions, rooms, environment readings. Food-safety and tasks are the surprising ones. Cultures/presets/truth-source can be created but not edited.
- **No inline editing and no real optimistic updates** (the `EntityForm` comment claims optimistic; the code awaits a full round-trip + refetch).
- **No schema validation** (`zod` appears zero times); validation is hand-rolled per action.

#### C. Trust, data integrity & production-readiness

- **No authentication whatsoever.** Every page renders with the Supabase **service-role key** server-side, which bypasses RLS. There is no login, no middleware, no session. Anyone with the URL has full read/write to the entire operation. The RLS policies in the migrations (`authenticated using(true)`) are decorative because no authenticated end-user session ever exists. An anonymous visitor can even trigger your GitHub Actions sheet-import via the `/sync` button.
- **Migration version collisions.** Eight migration files share two timestamps (six at `20260609000000_14_*`, two at `20260611000000_*`). Supabase keys migrations by the leading timestamp, so these collide on the same version string and a clean `db push` to a fresh project is fragile. Statements are individually idempotent, so it's a completeness risk, not a corruption risk — but it must be fixed before anyone stands up a second environment.
- **The source-of-truth loop is half-built.** Sheet → Supabase (pull) works. Manual UI entry → Supabase works. Supabase → Sheet (push) is a stub: every UI write enqueues to `sheet_sync_queue`, but nothing ever drains it. So a sheet re-import silently overwrites manual edits on synced tables. Effective reality is "last writer wins, and the sheet usually wins."
- **No web tests.** CI runs typecheck/lint/build only. The 12 pytest tests cover the dead FastAPI backend.
- **Brand spec drift.** README says the fonts are DM Mono + Syne; the app actually loads Fraunces + Inter + JetBrains Mono. Decide which is canonical and align them.

### 1.5 Competitive read

The README benchmarks against MycoSense (enterprise farm OS), Kinoko (mid-size ops), and the Sporehubs/MycoFile SMB tier, and it has already implemented the hard, differentiating backend pieces those tools charge for: FSMA-204 one-click recall, predictive yield forecasting, multi-tier inventory valuation, a spent-substrate circular-economy ledger, and per-strain biological-efficiency analytics. **On backend capability you are already competitive-to-ahead.** Where the incumbents will still feel more finished is exactly the two things you flagged: fluid cross-entity navigation and confident, forgiving data entry. That is good news — the moat is built; the remaining work is the surface the user touches.

---

## Part 2 — The Plan: getting to "perfect and highly competitive"

The plan is sequenced so that each phase rests on the one before it. Two **keystone abstractions** unlock most of the value and should be built first within their phase, because everything else plugs into them:

> **Keystone 1 — the Link Resolver.** A single `hrefFor(entityType, id)` + `<EntityRef>` component so that *no entity reference is ever dead text again*. Every strain, batch, harvest, order, customer, vendor, PO mentioned anywhere becomes a consistent, styled, clickable node. This is the spine of the "click a node → jump to the relevant point" experience.
>
> **Keystone 2 — the Entity Schema Registry.** Extend `web/lib/entities.ts` (which already calls itself "the single source of truth") so it drives the **create** form, the **edit** dialog, the **detail-page** field rendering, and **validation** — all from one definition per entity. This permanently kills the create/edit divergence and makes manual entry uniform everywhere.

### Phase 0 — Foundation & trust _(do first; small, unblocks everything)_
0.1 Delete/archive the dead FastAPI stack and `shroom.db`; extract the Python importer to `/importer`.
0.2 Fix the migration timestamp collisions (give each of the 8 files a unique, correctly-ordered prefix; verify a clean `supabase db reset` applies all of them).
0.3 Decide the auth posture and implement it. If this stays a single-operation in-house tool, at minimum put it behind Vercel password protection or a single shared-password middleware gate, and require a shared secret on `/api/cron/*` and the `/sync` dispatch. If it's going multi-user, stand up Supabase Auth + a real session client and make the existing RLS policies load-bearing. **Ship *something* here — "anyone with the URL owns the data" is disqualifying for "production-grade."**
0.4 Add a minimal web test setup (Vitest + Playwright smoke) and wire it into `ci.yml`, so the later phases are safe to move fast in.

### Phase 1 — The cross-linked navigation flow _(your #1 priority)_
1.1 **Build Keystone 1** (`hrefFor` + `<EntityRef>`).
1.2 **Create the missing high-value detail pages, modeled exactly on `batches/[id]`:** `orders/[id]` and `harvests/[id]` first (the two black holes on the traceability spine), then `vendors/[id]` and `purchase-orders/[id]`.
1.3 **Make every reference a link** using `<EntityRef>`: order numbers everywhere, harvest rows on strain/batch pages, customer order-history rows, batch material rows → supply items, vendor ⇄ PO ⇄ supply.
1.4 **Add a shared `<Breadcrumbs>` + context-aware back**, fed by `nav.ts` (`labelForPath`/`sectionForPath` already exist), reflecting the actual trail.
1.5 **Add URL search-param state** for list filters, tabs, and board views so every filtered view is shareable, refresh-safe, and back-button-friendly.
1.6 **Expand the command palette** to index harvests, vendors, POs, and tasks, and point order results at `orders/[id]`.

### Phase 2 — Manual entry excellence _(your #2 priority)_
2.1 **Build Keystone 2** (schema-driven create + edit + validation from `entities.ts`), and migrate every entity onto it, reconciling the diverged enums/fields as you go. Add real `zod` validation derived from each `EntityDef`.
2.2 **Replace native FK `<select>`s with a searchable combobox** (typeahead) — one component, design-system-styled, keyboard-first.
2.3 **Add inline "create related record"** (e.g. "+ New vendor" inside the PO form), generalizing the existing `PresetMaterialsField` pattern.
2.4 **Fill the create gaps** (tasks, products, campaigns, food-safety logs, subscriptions, rooms, readings) — automatically covered once they're registry entries.
2.5 **Fix input honesty:** stop coercing bad numbers to defaults (reject with a field message), map Postgres unique-violation errors to friendly copy, and surface field-level inline validation instead of only a post-submit toast.
2.6 **Add true optimistic updates** on create/edit/delete so the table reflects the change instantly.

### Phase 3 — Last-mile beauty _(makes it feel best-in-class)_
3.1 Extract `<PageHeader>`, `<Table>`, and `<EmptyState>` (currently copy-pasted across 27 pages) so the editorial rhythm is structural, not incidental.
3.2 **Redesign empty states** — brand illustration (SporeMark/hypha), one-line explanation, and a primary CTA ("Add your first strain"). These are the first screens a new/empty operation sees.
3.3 Add a **restrained line-icon set** matching SporeMark's 1.3px stroke language to nav groups and row actions for scannability (especially on mobile).
3.4 **Tame glow hierarchy** — reserve the strongest cyan glow for one hero element per view so hierarchy reads; quiet secondary surfaces.
3.5 Pull scattered inline `style={{}}` into tokens/utility classes; resolve the font-spec discrepancy.

### Phase 4 — Competitive moat & scale
4.1 **Finish or retire the sheet round-trip.** Either implement the Supabase → Sheet drain (a real consumer of `sheet_sync_queue`) or make the sheet import-once and declare Supabase the sole source of truth. Ambiguous ownership is worse than either clear answer.
4.2 **Ship the flagship innovations from the README roadmap** that are already scaffolded: computer-vision contamination early-warning, the demand-driven production planner, and the strain-portfolio optimizer. These are the features no SMB competitor has.
4.3 Multi-user/roles/org isolation if you're selling beyond one operation (builds on Phase 0.3).
4.4 Grow web test coverage to cover the traceability spine and the create/edit flows.

**Suggested order of attack:** Phase 0 → Phase 1 → Phase 2 → Phase 3, with Phase 4 items slotted in opportunistically. Phases 1 and 2 are the ones that directly deliver the "intuitive, beautiful, cross-linked, easy-to-input" experience you described, and they're built on the two keystones, so build those keystones first.

---

## Part 3 — Opus 4.8 Handoff Prompts

Each prompt below is **self-contained** — it restates the context it needs so you can paste it into a fresh Opus 4.8 session without this document. They're ordered to match the plan. Hand them off roughly one phase at a time; within a phase, the keystone prompt (marked ★) should be completed and merged before the others in that phase, because the others depend on it.

Global guardrails to include in every session (repeat these — they matter):

> **House rules for this repo.** Work only in `/web` and `/supabase`. There is a hand-authored design system in `web/app/globals.css` (OKLCH tokens, fluid type, named easings) — reuse its tokens and classes; never introduce Tailwind, a component library, or hardcoded colors/hex. Every animation must respect `prefers-reduced-motion` (use the existing `useReducedMotion` hook / CSS pattern) and render its final state on the server (no hydration flash). Reads happen in server components via `createServiceClient()` + the `must/soft/maybe` helpers in `web/lib/query.ts`; writes happen in `"use server"` actions that `revalidatePath` and return the `EntityResult { ok, message }` contract. Match the existing file conventions. Run `npm run typecheck && npm run lint && npm run build` before declaring done. Keep diffs reviewable and commit logically.

---

### Prompt 0.1 — Remove dead weight

```
Context: The Shroom OS repo has two backends. The Next.js + Supabase app in
/web + /supabase is production. The FastAPI + SQLite + vanilla-JS stack in
/backend, /frontend, and the committed /shroom.db file is a legacy reference
with ZERO runtime coupling to the web app (grep confirms no references to
fastapi/backend/localhost:8000 anywhere in /web). The only living piece is the
Python sheet importer at backend/app/sheet/, which .github/workflows/sheet-import.yml
still invokes.

Task:
1. Extract backend/app/sheet/ (and only its real dependencies) into a new
   top-level /importer package, updating sheet-import.yml and requirements.txt
   to match. Verify the workflow's `python -m ...` invocation path still resolves.
2. Delete /backend, /frontend, /shroom.db, and the now-orphaned root-level
   run.sh/setup.sh/tests that only served the FastAPI demo. Keep anything the
   importer or CI still needs.
3. Update the root README.md so it describes ONE product (web + Supabase +
   importer), removing all FastAPI/SQLite/vanilla-JS references and the
   "writes to both stores" language. Fix the SHEET_MAPPING.md dual-target claims.
4. Confirm `.gitignore` covers *.db and that no demo DB is tracked.

Acceptance: `git grep -i fastapi` and `git grep localhost:8000` return nothing;
the sheet-import workflow's import path is valid; README describes a single stack.
Do not touch /web application code.
```

### Prompt 0.2 — Fix migration ordering

```
Context: In supabase/migrations, eight files share two timestamps — six named
20260609000000_14_*.sql and two named 20260611000000_*.sql. Supabase keys
migrations by the leading numeric timestamp, so these collide on the same
version string; `supabase db push` to a fresh project may skip duplicates and
their relative order is undefined. The suffix numbers (_14_, _15_) are NOT part
of the version key. All statements are individually idempotent (create ... if
not exists / add column if not exists), so this is a completeness risk, not a
corruption risk.

Task: Rename the colliding files to give each a unique, strictly-increasing
timestamp prefix that preserves the intended logical order (respect the _14_/_15_
sequence hints and any real dependency — e.g. drop_inoculation_stage after the
tables it depends on exist). Do not change file contents except where a rename
requires an internal reference update. Then verify a clean apply:
`supabase db reset` (or the project's equivalent) must run all migrations in
order with no errors on an empty database.

Acceptance: no two migration files share a timestamp prefix; a from-scratch
apply succeeds; the resulting schema is identical to today's.
```

### Prompt 0.3 — Establish an authentication posture (DECISION REQUIRED)

```
Context: The web app has NO authentication. Every page renders server-side with
the Supabase service-role key (web/utils/supabase/service.ts), which bypasses
RLS. There is no login page, no middleware.ts, no session. Anyone with the
deployed URL has full read/write to all data, and can trigger the GitHub Actions
sheet-import via the /sync button. The migrations define RLS policies
(`authenticated using(true)`) that are never exercised.

This is the single biggest production gap. Two viable directions — the product
owner should choose, but implement (A) as the safe default if unspecified:

(A) SINGLE-TENANT LOCKDOWN (fast, low-risk): Put the whole app behind one
    shared-password gate via a Next.js middleware.ts that checks a signed cookie
    set by a minimal /login route (password compared against an env secret).
    Add a required bearer secret to /api/cron/* and to the /sync workflow-dispatch
    action so they can't be triggered anonymously. Keep the service-role read
    model as-is behind the gate.

(B) MULTI-USER (fuller): Stand up Supabase Auth, add an authenticated browser/SSR
    client, a login flow, and make the existing RLS policies load-bearing (switch
    reads off service-role where a user session suffices; keep service-role only
    for privileged server actions). Introduce org_id/tenant scoping if multi-op.

Task: Implement the chosen option end-to-end, including protecting the cron and
sync endpoints. Add a short docs/AUTH.md explaining the model. Do not weaken the
existing CSP/security headers in next.config.mjs.

Acceptance: an unauthenticated request to any /(app) route and to the cron/sync
endpoints is rejected; authenticated access works; typecheck/lint/build pass.
```

### Prompt 1.1 ★ — Keystone 1: the Link Resolver + EntityRef

```
Context: This Next.js + Supabase app (Quantum Blue / Shroom OS) has a rich
entity model — strains, batches, harvests, orders, customers, vendors,
purchase-orders, supplies/inventory items, tasks, cultures — but entity
references are inconsistently linked. Order numbers, harvest ids, vendor names,
and supply items render as plain non-clickable text in many places, while a few
(batch, strain, customer) are linked. The product owner's top priority is a
smooth "click any information node to jump to the related record" flow. The
batch detail page (web/app/(app)/batches/[id]/page.tsx) is the quality bar.

Task: Build ONE canonical linking layer so no entity reference is ever dead
text again.
1. Create web/lib/links.ts exporting `hrefFor(type, id)` for every entity type,
   returning the detail-page path (e.g. hrefFor("order", 12) => "/orders/12").
   For types whose detail page doesn't exist YET (order, harvest, vendor,
   purchase-order, supply), return the best available target now (the list, or a
   list deep-link) and leave a clearly-marked TODO so it upgrades to the real
   path when Prompt 1.2 lands. Centralize this so later work flips one line.
2. Create web/components/EntityRef.tsx — a small server-safe component that
   renders a styled, accessible link for an entity: `<EntityRef type="order"
   id={o.id} label={o.order_number} />`. It must use the existing `.row-anchor`
   / link styles from globals.css (reuse, don't invent), support an optional
   `tone`/badge variant to match existing inline badge-links (see the strain
   chip in batches/[id]/page.tsx:199), and degrade to plain text if id is null.
3. Do NOT yet rewrite call sites — that's Prompt 1.3. Just ship the two
   primitives with a couple of usages as proof (e.g. wire the order number in
   web/app/(app)/orders/page.tsx and the customer order-history table in
   customers/[id]/page.tsx through EntityRef).

Reuse the existing design tokens and link classes; do not add new colors.
Acceptance: EntityRef renders correct hrefs for all types; the two proof sites
are now clickable; typecheck/lint/build pass. Keep the API tiny and documented
so every later prompt can lean on it.
```

### Prompt 1.2 — The missing detail pages (model on batches/[id])

```
Context: In this Next.js + Supabase app, only strains/[id], batches/[id], and
customers/[id] have detail pages. The batch detail page
(web/app/(app)/batches/[id]/page.tsx) is the gold standard: a hero with badges
that link to related entities, a KPI row, a LifecycleRing, related-record tables
(harvests, materials, downstream orders) with outbound links, and a RowActions
edit/delete affordance. Twenty other routes are drill-in dead-ends. The two most
damaging gaps are ORDERS (no page — order numbers are dead text everywhere and
you can never navigate INTO an order) and HARVESTS (no page — yet harvests are
the traceability pivot linking batch ↔ order line ↔ label). Use the EntityRef /
hrefFor primitives from web/lib/links.ts + web/components/EntityRef.tsx for every
outbound reference.

Task: Build four new detail pages, each closely modeled on batches/[id] in
structure, spacing, and component usage (Card, Kpi, Badge, RowActions, tables
with sr-only captions and scope). Read from Supabase in the server component via
createServiceClient() + must/soft/maybe helpers, `export const dynamic =
"force-dynamic"`, and Promise.all for parallel reads.

1. orders/[id]: order header (number, date, channel, payment/fulfillment status
   as badges), customer link, and a LINE-ITEMS table where each line links to its
   harvest/lot (order_lines.harvest_id) and product — this closes the
   order→line→harvest traceability that currently has no UI. Show totals.
2. harvests/[id]: harvest header (lot, flush, dates, fresh/dry g, dry-ratio with
   the below-floor flag), links UP to its batch and strain, links DOWN to any
   order lines that consumed it and to the printable label
   (label/harvest/[id]). This makes every harvest reference in the app a real
   destination.
3. vendors/[id]: vendor header + contact, plus tables of that vendor's purchase
   orders and supplied inventory items (each linked). Currently the whole Source
   group has zero internal links.
4. purchase-orders/[id]: PO header, vendor link, line items / supplies received.

For each, add a context-aware back link and wire RowActions using the entity's
registry definition in web/lib/entities.ts (add registry entries if missing).
After these ship, update web/lib/links.ts to point hrefFor at the real paths.

Acceptance: each page renders for a real id, 404s cleanly for a bad id, and every
related record on it is a working link; the batch and strain pages' harvest rows
and the orders references now resolve to these pages; typecheck/lint/build pass.
```

### Prompt 1.3 — Make every reference a link, symmetrically

```
Context: Now that web/components/EntityRef.tsx + web/lib/links.ts exist and the
orders/harvests/vendors/purchase-orders detail pages are built, sweep the app and
replace every dead-text entity reference with an <EntityRef>. Today these are
plain text (non-exhaustive): order numbers in orders list, customer detail
order-history, and batch "downstream orders"; harvest rows on strains/[id] and
batches/[id]; batch "materials used" rows (inventory_item_id) on batches/[id];
vendor names on purchase-orders list; subscription→customer on customers/[id].
Links are also asymmetric — the orders LIST links customers but the customer
DETAIL order-history does not link orders.

Task: Grep the (app) tree for entity references rendered as <b>, plain <td>, or
badge text and convert them to <EntityRef> so navigation is bidirectional and
consistent. Prioritize: (1) order numbers everywhere, (2) harvest rows, (3)
customer detail order-history → orders, (4) the whole Source group (vendor ⇄ PO
⇄ supply), (5) batch materials → supply items. Do not change data fetching except
to select the id/label fields a link needs.

Acceptance: no entity name/number that has a detail page renders as dead text;
every list↔detail relationship is navigable in both directions; visual styling
is unchanged (EntityRef reuses existing link classes); typecheck/lint/build pass.
```

### Prompt 1.4 — Breadcrumbs, context-aware back, and URL filter state

```
Context: This app has no breadcrumbs and no URL state for filters. Each detail
page has a single hardcoded "← Back to <list>" that ignores how you arrived
(reaching a strain from a batch still says "← Strain library"). List filters,
segmented tabs (web/components/Segmented.tsx), and board views (BatchBoard/
TentBoard) keep state in React only, so no filtered view is shareable, refresh-
safe, or back-button-restorable. `useSearchParams` is used zero times. The nav
module web/lib/nav.ts already exposes labelForPath() and sectionForPath().

Task:
1. Add a shared <Breadcrumbs> component driven by nav.ts (Group › List › Record)
   plus a context-aware back link that prefers the actual referrer trail (pass a
   `from` search param when navigating in from a related record; fall back to the
   parent list). Place it at the top of every detail page, replacing the
   hardcoded back links.
2. Lift list filters, segmented tabs, and board filters into URL search params
   (nuqs-style but implement with the native Next useSearchParams/router — do NOT
   add a dependency unless justified). Reading initial state from the URL, writing
   on change with router.replace (no scroll jump), so filtered views are
   shareable and survive refresh + back button. Keep it server-render-friendly.
3. Ensure the command palette and EntityRef links can carry a `from` param so the
   back trail is correct.

Respect reduced-motion and existing styles. Acceptance: filtered/tabbed views are
deep-linkable and restore on refresh; breadcrumbs reflect real location; back
link respects the arrival path; typecheck/lint/build pass.
```

### Prompt 2.1 ★ — Keystone 2: unify create + edit on the schema registry

```
Context: Manual data entry in this app is split across two systems that have
drifted apart. Create uses bespoke web/app/(app)/*/Add*Form.tsx components +
per-route addX server actions. Edit/delete is driven by a central registry,
web/lib/entities.ts (the ENTITIES map — it already documents itself as "the
single source of truth"), consumed by web/components/EditDialog.tsx and generic
updateEntity/deleteEntity in web/lib/crud.ts. Because the two are authored
separately, they disagree, and data entered on create often can't be edited:
- Orders: create channels retail/wellness/market/online + payment/fulfillment
  status; edit channels csa/farmers_market/restaurant/dtc + no payment status.
- Strains: create collects target_temp_f/target_humidity/target_co2_ppm/priority
  that DON'T exist in the edit registry (uneditable after creation).
- Customers and contamination have the same divergence (contamination create has
  a curated type dropdown + photo_url; edit downgrades type to freetext, drops
  photo).
There is no zod; validation is hand-rolled per action and silently coerces bad
numbers to defaults.

Task: Make web/lib/entities.ts the ONE source of truth for create, edit, detail
field-rendering, and validation.
1. Extend each EntityDef so a single definition fully describes the entity's
   fields (type, enum options, required, fk, min/step, default). Reconcile every
   diverged enum/field to ONE correct vocabulary per entity — decide the right
   set (prefer the richer/more-correct one) and migrate any existing data/enum
   references to match. Document each reconciliation decision in the PR.
2. Build a generic, schema-driven <EntityForm> create experience that renders
   from the registry (mirroring how EditDialog already renders edit from it), so
   "Add X" and "Edit X" are the SAME fields and enums. Replace the bespoke
   Add*Form.tsx components with the generic one (keep any genuinely special UX —
   e.g. AddHarvestForm's live dry-ratio and SKU suggestion, AddBatchForm's
   preset prefill, PresetMaterialsField — as opt-in custom field renderers the
   registry can reference, not as forks of the whole form).
3. Derive zod schemas from each EntityDef and validate in the create/update
   actions. STOP coercing invalid numbers to defaults — reject with a
   field-level message. Map Postgres unique-violation errors to friendly copy
   (e.g. "That lot code is already in use").

Acceptance: for every entity, the fields/enums you can set on create are exactly
the ones you can edit; invalid input is rejected with a clear per-field message,
not silently defaulted; the special-case UX (dry-ratio, preset prefill, BOM
editor) still works; typecheck/lint/build pass. This is the highest-impact data-
integrity fix in the app — be thorough and list every reconciliation you made.
```

### Prompt 2.2 — Searchable FK combobox + inline "create related"

```
Context: After Prompt 2.1, create and edit share a schema-driven form built from
web/lib/entities.ts, where foreign-key fields render as native <select>. There is
NO typeahead anywhere in the app (confirmed zero comboboxes/datalists), so strain/
customer/batch/vendor pickers become unusable as those tables grow. There is also
no way to create a related record inline — you can't add a vendor while writing a
purchase order; you must abandon the form, go create the vendor, and come back.
The design system lives in web/app/globals.css (OKLCH tokens, focus-visible
rings, existing input styles); reduced-motion support is via useReducedMotion.

Task:
1. Build ONE accessible, design-system-styled combobox component (typeahead over
   the fk option list: keyboard-first, arrow/enter/escape, aria-activedescendant,
   reduced-motion-aware, reuses existing input/glow tokens). Make the schema-
   driven form use it for every fk field automatically (registry flag), so all
   relationship pickers get search for free.
2. Add an inline "＋ New <entity>" affordance inside the combobox that opens the
   generic create form for the related entity in a lightweight modal, and on save
   selects the newly-created record back into the field — generalizing the
   existing inline pattern in presets/PresetMaterialsField.tsx. Wire it for the
   high-value cases first: vendor-from-PO, customer-from-order, strain-from-batch.

Acceptance: every fk picker is searchable and keyboard-navigable; you can create
and immediately select a related record without leaving the form; matches the
existing visual language; respects reduced-motion; typecheck/lint/build pass.
```

### Prompt 2.3 — Close the create gaps + optimistic updates

```
Context: After Prompts 2.1–2.2, entities are created/edited from one schema-
driven form built on web/lib/entities.ts. Several entities still have NO manual-
create path in the UI (they can only be edited if they exist, or only generated):
tasks (only bulk-materialized from a protocol on the batches page — no ad-hoc
task create), products/catalog, campaigns/marketing, food-safety logs,
subscriptions, rooms, and environment readings. Cultures/presets/truth-source can
be created but not edited. Also, mutations are not optimistic — the table doesn't
update until a full server round-trip + refetch completes (the EntityForm comment
claims "optimistic disable" but the code just awaits).

Task:
1. Give every listed entity a registry-backed create form and, where missing, an
   edit path (add EntityDef entries; surface AddPanel + RowActions on their list
   pages). Food-safety logs and ad-hoc tasks are the priority — a compliance tool
   that can't record a food-safety log manually is a real gap.
2. Add true optimistic updates to create/edit/delete: reflect the change in the
   list immediately, then reconcile on the server response, rolling back with a
   toast on failure. Keep the EntityResult { ok, message } contract.

Acceptance: every primary entity can be created, edited, and deleted from the UI;
create/edit/delete feel instant; failures roll back cleanly; typecheck/lint/build
pass.
```

### Prompt 3.1 — Extract PageHeader / Table / EmptyState + redesign empty states

```
Context: This app's look is consistent because a 3,173-line hand-authored
web/app/globals.css enforces it, but the MARKUP is copy-pasted. The editorial page
header block (<div class="eyebrow">…<h1 class="section">…<p class="lead">…) is
hand-repeated in 27 pages; raw <table> markup with its a11y pattern (sr-only
caption, scope="col", .right, .row-anchor) is retyped everywhere; and empty states
are ad-hoc one-liners (`<p class="muted">The strain library is empty.</p>`). These
are the first screens a new/empty operation sees, and they're the weakest surface.
Signature components already exist and are good: SporeMark (logo), Card, Kpi,
Badge, the anim/* primitives.

Task:
1. Extract three shared components that reuse existing classes/tokens exactly:
   <PageHeader eyebrow title lead actions?> (dedupe all 27 sites, guaranteeing
   heading level + spacing), <DataTable> (wrap the a11y table pattern once), and
   <EmptyState icon title body cta?>. Do NOT change the rendered visuals — this is
   a consolidation, pixels should be identical where they already looked right.
2. Redesign empty states using <EmptyState>: a faint SporeMark or hypha
   illustration, a one-line explanation, and a primary CTA that opens the create
   form ("Add your first strain"). Apply across all list pages.

Acceptance: the 27 header sites and the table/empty-state sites now use the shared
components; visuals are unchanged except empty states, which are upgraded; a
designer changing header rhythm edits ONE file; typecheck/lint/build pass.
```

### Prompt 3.2 — Icon language, glow hierarchy, token cleanup

```
Context: The design system (web/app/globals.css, OKLCH tokens) is excellent but
has three last-mile polish gaps. (1) Navigation and tables have almost no
iconography — nav is text + color dots only, which hurts scannability on the
mobile drawer's long text list. (2) The cyan --lumen glow is applied to nearly
everything (cards, inputs, buttons, sparklines, gauges, meters, toasts, nav-
active), which flattens visual hierarchy — everything shimmers equally. (3)
Inline style={{}} is scattered through pages (e.g. dashboard, strains, error),
leaking spacing/color that should be tokens. SporeMark.tsx defines the house SVG
stroke language (~1.3px). A .card.quiet variant already hints at a calmer tier.

Task:
1. Add a small, restrained line-icon set matching SporeMark's stroke weight and
   feel (inline SVG components, no icon-library dependency), and apply them to nav
   groups/items and RowActions for scannability. Keep it tasteful — this is an
   editorial brand, not a dashboard clip-art fest.
2. Establish glow hierarchy: reserve the strongest --lumen glow for ONE hero
   element per view; quiet secondary surfaces (lean on/extend the .quiet variant).
   Document the rule in a comment block in globals.css.
3. Sweep inline style={{}} in the (app) tree into existing tokens/utility classes;
   add utilities only where a token gap genuinely exists.

Acceptance: nav/rows have consistent restrained icons; visual hierarchy reads at a
glance (not uniform shimmer); inline styles are largely gone; reduced-motion and
light/dark both still correct; typecheck/lint/build pass.
```

### Prompt 4.1 — Resolve the source-of-truth loop (DECISION REQUIRED)

```
Context: The "single source of truth" story is half-built and currently unsafe
for manual edits. Sheet → Supabase (pull) works via the Python importer + GitHub
Action. Manual UI entry → Supabase works. But Supabase → Sheet (push) is a stub:
every UI write enqueues a row to the sheet_sync_queue table (web/lib/sync.ts),
yet NOTHING drains it — markAllSynced (web/app/(app)/sync/actions.ts) just stamps
synced_at without pushing. So re-importing the sheet silently OVERWRITES manual
edits on synced tables (strains, customers, harvests, batches). Effective reality
is "last writer wins, sheet usually wins."

Pick ONE and implement it (the product owner should choose; default to (B) if
unspecified, since it's simpler and safer):

(A) TWO-WAY SYNC: implement a real consumer that drains sheet_sync_queue back to
    the Google Sheet (via the service-account the importer already uses), with
    conflict handling and clear last-sync provenance in the UI. Higher effort,
    higher risk.
(B) SUPABASE AS SOLE TRUTH: demote the sheet to an initial/one-time import.
    Remove or clearly quarantine the enqueue-on-write path and the "Sync from
    sheet" overwrite behavior for tables that are now UI-owned, so manual edits
    are never clobbered. Keep the importer for bootstrapping/backfill only, gated
    behind an explicit confirm.

Task: Implement the chosen direction end-to-end, update /sync UI copy to tell the
truth about what syncing does, and document the final model in docs/. Remove the
misleading "single source of truth = the sheet" language wherever it no longer
holds.

Acceptance: manual UI edits can no longer be silently overwritten by a routine
sync; the /sync screen accurately describes behavior; typecheck/lint/build pass.
```

---

## Appendix — Quick reference: files that matter most

| Concern | Key files |
|---|---|
| Nav / IA | `web/lib/nav.ts`, `web/components/Nav.tsx`, `MobileNav.tsx`, `CommandPalette.tsx` |
| Gold-standard detail page | `web/app/(app)/batches/[id]/page.tsx` |
| Entity registry (Keystone 2) | `web/lib/entities.ts`, `web/components/EditDialog.tsx`, `web/lib/crud.ts` |
| Create forms (to unify) | `web/app/(app)/*/Add*Form.tsx`, `web/components/EntityForm.tsx`, `AddPanel.tsx` |
| Design system | `web/app/globals.css`, `web/components/ui.tsx`, `web/components/anim/*` |
| Data access | `web/utils/supabase/service.ts`, `web/lib/query.ts` |
| Auth gap | (none yet) — `web/utils/supabase/service.ts`, absent `middleware.ts` |
| Schema | `supabase/migrations/*` (note the timestamp collisions) |
| Sync loop | `web/lib/sync.ts`, `web/app/(app)/sync/actions.ts`, `sheet_sync_queue` |
| Deploy / CI | `web/vercel.json`, `web/next.config.mjs`, `.github/workflows/*` |
