# Reliability review — October 6, 2026

## Immediate completion gates

- Provision read-only Google service-account access and GitHub import secrets. The last successful live import inspected was September 25; a connector read is not proof that the scheduled importer works.
- Review the 60 draft bag records before importing. Sixteen need review because strain matching or dates are uncertain. Live data has 99 Magic and 15 functional batches, so the client's count of 63 cannot safely define a reset.
- Archive an explicitly selected set of old batches. Archiving preserves harvests, orders and history; deletion does not.
- Reconcile legacy harvest references before the first native import. Combined drying totals must be represented once, with links to contributing picks. The TAT notes describe two picks totaling 133 g fresh and 9 g dry; assigning that dry total to each pick would double-count it.

## Likely future failures and prevention

| Priority | Risk | Prevention / completion evidence |
| --- | --- | --- |
| High | Imports stop silently after credentials, sharing or column changes | The new health endpoint and dashboard flag stale/failed imports. Connect an external alert and demonstrate a successful scheduled native import. |
| High | A Sheet edit overwrites a valid harvest or changes its identity | Import guards reject duplicate references, identity moves, invalid weights and reductions over 50%; revisions record accepted edits. Add explicit Harvest IDs and review smaller corrections as well. |
| High | App edits disappear at the next Sheet import | Document field ownership. Sheet-managed cultivation fields need correction in the Sheet while write-back is disabled; app-only orders, tasks, photos and archive state remain in the app. |
| High | A backup cannot restore the whole operation | Today's snapshot covers public table data only. Schedule and restore-test schema, Auth and storage backups. Resolve historical migration ordering before claiming fresh-install recovery. |
| Medium | Growing tables silently truncate dashboards or import lookups | Introduce pagination and aggregate queries before approaching API row limits; test with data above those limits. Current counts do not establish a growth deadline. |
| Medium | Preset material replacement fails between deleting old rows and saving new ones | Move replacement into one database transaction and verify all preset types with real material combinations. Numeric input precision was corrected, but this is not proof of the client's intermittent cause. |
| Medium | Framework or dependency advisories outlive a patch cycle | Sharp is updated to 0.35.5. Assess remaining Next.js and tooling advisories with upgrade compatibility checks; do not treat a successful build as a security audit. |
| Medium | Authentication accepts known compromised passwords | Review Supabase's existing disabled leaked-password protection setting and enable it with a tested sign-up/reset flow. |

## Forecasting limits

Operational failure modes can be ranked now. Harvest yield, time to fruiting and purchasing forecasts need stable bag IDs, linked flushes, reliable dates and correctly attributed drying weights first. Start with observed ranges per strain and process, show sample counts and uncertainty, and compare forecasts with later actual harvests before using them for customer commitments.
