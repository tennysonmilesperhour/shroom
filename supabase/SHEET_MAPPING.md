# Master Cultivation Sheet → Shroom OS mapping

The Google Sheet (*Master Cultivation Reference*) is treated as a **read-only
reference**. We did **not** modify the sheet. Its tabs are mirrored into the
Supabase schema additively — filling gaps without overriding the normalization
improvements already in the model.

| Sheet tab | Schema target | Notes |
|---|---|---|
| Setup / Equipment | `equipment` | Martha Tent, humidifier, FAE fan, Inkbird IBT + IAM-T2, dehydrator, etc. Linked to `rooms`. |
| Environment Parameters | `rooms` targets + `environment_readings` | Sheet tracks **°F ranges**; we store a normalized single target in **°C** and the app converts to °F for display + the in-spec check. Ranges (e.g. 75–78 °F) documented in equipment/room notes. |
| Strains (active/colonizing/inoculating) | `strains` + `batches` | Tub/Bag ID → `batches.container_id`; transfer/mix/first-pin dates → `batches.*_on`; rating → `batches.rating`. |
| Spore library (fridge) | `strains` (`library_status`, `priority`, `acquired_on`, `syringes_on_hand`) | Full 19-strain library imported (psychedelic + functional). |
| Pricing Reference | `price_tiers` | Wholesale/distributor/retail (medicinal) + farmers-market/restaurant/Harmons/DTC (functional). |
| Harvest Tracker | `harvests` (+ `dry_ratio_pct` generated) | Real numbers loaded (SG F1 445/31.2 = 7.0%, IW F1 723.5/46.8 = 6.5%, IW F2 428/26.9 = 6.3%). |
| Jar / Dry Inventory | `dry_inventory` | Jar ID, dry weight, used, `remaining_g` (generated). J-01…J-03 seeded. |
| Cycle Log | `batches` + `stage_events` | Inoculated → Mixed → Transferred → First Pins → Harvest lifecycle. |
| Protocols (checklists) | `protocols` | 5 SOPs with ordered `steps` (jsonb): Inoculation, Post-Harvest Dunk & Reset, Harvest Day, Daily Env Check, Bulk Transfer. |
| Contamination + Troubleshooting | `reference_guides` | 6 contamination + 11 symptom→fix entries. Feeds the AI advisor. |
| Issue Log | `issue_log` | 18 lessons-learned entries (date, issue, root cause, resolution). |
| Vendors / Sourcing | `vendors` | Supplies, spores, functional, and Chaga wild-harvest sourcing leads. |
| Sales Leads | `customers` (CRM fields) | `status`, `role`, `price_tier`, `volume_est`, `region`, `last_contact`, `follow_up_date`, `priority`. Named leads imported (Jackie, Jonathan, Tennysion, Daniel, Amanda, Greg, Harmons, markets, naturopaths, Haven). |

## Deliberate differences (improvements kept, not overridden)

- **Units:** sheet is °F / gal; DB stores °C / kg normalized, app localizes to the
  operator's °F/gram mental model on display + input.
- **Traceability spine** (`Strain → Batch → Harvest → OrderLine → Order →
  Customer`) and **RLS** are model improvements with no sheet equivalent — kept.
- **Ease rating** adopts the sheet's **/10** convention.
- The sheet's duplicate pricing/contact data (which lived in two files) collapses
  into single normalized tables here — directly resolving the documented
  single-source-of-truth headache.

## Recommended next reference-driven features

1. **Protocol-aware tasks:** generate the Daily Environmental Check + Harvest Day
   checklists as recurring tasks per active batch.
2. **Advisor grounding:** feed `reference_guides` + `issue_log` into the AI
   advisor so its answers cite the operation's own hard-won lessons.
3. **Container/tub board:** a Kanban by `container_id` + `library_status` mirroring
   how the sheet tracks T-/G- IDs through the lifecycle.
