r"""CLI entry point for the reverse sync — write the app's data back into the
Master Cultivation Reference (App -> Sheet).

This is the batch/unattended counterpart of ``POST /api/sync/push``: it reads
the configured database (``SHROOM_DB_URL``) and upserts every owned tab into the
configured write target, so a scheduled job — or the in-app "Push to sheet"
button, via GitHub ``workflow_dispatch`` — can keep the workbook current with
the app without anyone re-typing rows.

The write is the same **non-destructive keyed upsert** the endpoint uses: owned
rows are matched on their natural key and updated in place, new ones appended,
and any columns/rows the operator maintains by hand are left untouched.

Examples
--------
Local DB into a local .xlsx (offline, fully testable)::

    python -m backend.app.sheet.exporter --path ./out.xlsx

Live push in CI (Supabase Postgres -> a native Google Sheet)::

    SHROOM_DB_URL=postgresql://... MASTER_SHEET_GOOGLE_ID=... GOOGLE_OAUTH_TOKEN=... \
        python -m backend.app.sheet.exporter

Environment variables (defaults when flags are omitted):
  SHROOM_DB_URL                      the database to read (sqlite:///./shroom.db by default)
  MASTER_SHEET_GOOGLE_ID             a native Google Sheet (recommended write target)
  MASTER_SHEET_FILE_ID               an .xlsx on Google Drive
  MASTER_SHEET_PATH                  a local .xlsx
  GOOGLE_OAUTH_TOKEN                 access token with drive + spreadsheets write scope
"""
from __future__ import annotations

import argparse
import json
import sys

from ..database import SessionLocal
from . import export, writer as writer_mod


def run(*, path: str | None = None, token: str | None = None) -> dict:
    """Read the DB and push every owned tab through the configured writer."""
    w = writer_mod.resolve_writer(path=path, token=token)
    db = SessionLocal()
    try:
        counts = export.push(db, w)
    finally:
        db.close()
        w.close()
    return {"target": writer_mod.describe_target(), "written": counts}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description="Export the app's data back into the Master Cultivation Reference.")
    ap.add_argument("--path", help="Local .xlsx path (overrides MASTER_SHEET_PATH).")
    ap.add_argument("--token", help="Google OAuth access token (overrides GOOGLE_OAUTH_TOKEN).")
    args = ap.parse_args(argv)

    try:
        summary = run(path=args.path, token=args.token)
    except Exception as exc:  # surface a clean message, not a traceback, to operators
        print(f"Export failed: {exc}", file=sys.stderr)
        return 1

    print(json.dumps({"status": "ok", "direction": "app->sheet", **summary}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
