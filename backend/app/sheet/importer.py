r"""CLI entry point for the Master Cultivation Reference importer.

Examples
--------
Local file into the FastAPI SQLite DB::

    python -m backend.app.sheet.importer --target sqlite \
        --path ~/Mushrooms/Master\ Cultivation\ Reference.xlsx

Pull from Google Drive into both stores (unattended / CI)::

    GOOGLE_OAUTH_TOKEN=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
        python -m backend.app.sheet.importer --target both

Environment variables (used as defaults when flags are omitted):
  MASTER_SHEET_PATH, MASTER_SHEET_FILE_ID, GOOGLE_OAUTH_TOKEN,
  NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
"""
from __future__ import annotations

import argparse
import json
import os
import sys

from ..database import SessionLocal, init_db
from .parse import ParsedWorkbook, parse_workbook
from .sinks import SqliteSink, SupabaseSink
from .source import resolve_workbook


def import_to_sqlite(parsed: ParsedWorkbook) -> dict[str, int]:
    init_db()
    db = SessionLocal()
    try:
        return SqliteSink(db).run(parsed)
    finally:
        db.close()


def import_to_supabase(parsed: ParsedWorkbook, url: str, service_key: str) -> dict[str, int]:
    with SupabaseSink(url, service_key) as sink:
        return sink.run(parsed)


def run(target: str, *, path: str | None = None, file_id: str | None = None,
        token: str | None = None, supabase_url: str | None = None,
        service_key: str | None = None) -> dict[str, dict[str, int]]:
    wb = resolve_workbook(path=path, file_id=file_id, token=token)
    parsed = parse_workbook(wb)
    summary: dict[str, dict[str, int]] = {}

    if target in ("sqlite", "both"):
        summary["sqlite"] = import_to_sqlite(parsed)

    if target in ("supabase", "both"):
        url = supabase_url or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL")
        key = service_key or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise RuntimeError(
                "Supabase target requires NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) "
                "and SUPABASE_SERVICE_ROLE_KEY."
            )
        summary["supabase"] = import_to_supabase(parsed, url, key)

    return summary


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="Import the Master Cultivation Reference sheet.")
    ap.add_argument("--target", choices=["sqlite", "supabase", "both"], default="both")
    ap.add_argument("--path", help="Local .xlsx path (overrides MASTER_SHEET_PATH).")
    ap.add_argument("--file-id", help="Google Drive file id (overrides MASTER_SHEET_FILE_ID).")
    ap.add_argument("--token", help="Google OAuth access token (overrides GOOGLE_OAUTH_TOKEN).")
    ap.add_argument("--supabase-url", help="Supabase project URL.")
    ap.add_argument("--service-key", help="Supabase service-role key.")
    args = ap.parse_args(argv)

    try:
        summary = run(
            args.target, path=args.path, file_id=args.file_id, token=args.token,
            supabase_url=args.supabase_url, service_key=args.service_key,
        )
    except Exception as exc:  # surface a clean message, not a traceback, to operators
        print(f"Import failed: {exc}", file=sys.stderr)
        return 1

    print(json.dumps({"status": "ok", "imported": summary}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
