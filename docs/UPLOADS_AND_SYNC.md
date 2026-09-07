# Uploads and sheet sync

The **Sheet sync** page accepts a Master Cultivation Reference `.xlsx` workbook directly from a device. Choose one workbook, preview its record counts and warnings, then import. Device import uses the existing Supabase configuration; Google and GitHub credentials are not needed.

Workbooks are limited to 4 MiB, 40 MiB expanded ZIP content, 2,000 ZIP entries, and 20,000 rows / 200 columns / 500,000 cells per worksheet. Encrypted workbooks, unrelated layouts, and unsupported file formats are rejected. Keep the reference tab names and headings. Formula cells use their last saved Excel values; recalculate and save in Excel before importing a workbook whose formulas changed.

The canonical parser in `backend/app/sheet/` supports 13 live record sections. Each physical container remains one batch, with its dated harvests/flushes and notes attached. Preview does not write to the database. Confirmation calls `import_workbook`, which commits all rows and its receipt in one transaction. Retrying the same receipt returns the original result. Matching spreadsheet fields update existing records; fields outside the import mapping are preserved, and no records are deleted.

The Strain Library accepts optional **Mushroom Type** (`Functional`, `Gourmet`, or `Psychedelic`) and **Species** columns. Exports include both so collection membership survives a round trip. Legacy Strain Library rows without a type retain the original parser's Psychedelic default; the functional incoming section retains its separate mapping.

Batch photos accept JPEG, PNG, and WebP up to 6 MiB / 40 megapixels. The browser requests a signed upload URL, uploads bytes directly to private Supabase Storage, and submits a signed receipt with the photo metadata. The server verifies the object and image format before adding it to the gallery. This avoids routing image bytes through Vercel's request-size limit. Keep the explicit Linux `sharp`/`libvips` tracing in `next.config.mjs`; a local macOS build cannot validate that deployment dependency.

Offline photos are committed to IndexedDB before the UI reports that they are queued. Reconnection uses the same upload path and mutation ID. Ordinary offline updates preserve their receipt IDs in history, so a lost response cannot replay a stage or room change over a newer edit. The regular offline queue refuses new items at 500 instead of dropping older work. Browser storage remains local to that device and origin; clearing site data removes unsynchronized work.

Cloud sheet import still requires GitHub repository secrets for the workbook source, Google access, and Supabase, plus `GITHUB_DISPATCH_TOKEN` in Vercel. The app records a request receipt before dispatch; the workflow completes or fails that receipt. A failed run can be retried immediately, and a running receipt becomes stalled after 15 minutes. Import and export workflows share one concurrency group.

Cloud export uses the reference backend's four mapped entities: strains, batches, harvests, and customers. Configure `SHROOM_DB_URL` with the `postgresql+psycopg://` driver for Postgres. Export preserves placeholder/operator-owned columns. Queue reconciliation acknowledges only known exported fields created before the export began; unmapped fields, empty/ambiguous payloads, and deletions remain pending. The manual reconciliation button explicitly confirms that it does not write the workbook.

The app retains its documented open-access model. Private Storage and server-only credentials do not create an application login boundary. JSON mutation endpoints check origin, sensitive RPCs require the server role, and the scheduled crawler requires `CRON_SECRET` in production. Support contact: **morphiclabsdata@gmail.com**.

Validation commands: `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` in `web`; `.venv/bin/python -m pytest tests -q` in the repository root. Browser upload and screenshot instructions are in `web/scripts/ui-check/README.md`. SQL regression scripts in `supabase/tests/` run inside transactions and end in `ROLLBACK`; run them against a database with the audit migrations applied.
