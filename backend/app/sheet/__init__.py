"""Live importer that makes the Master Cultivation Reference .xlsx the single
source of truth for both the FastAPI reference DB and the Supabase web app.

Pipeline:  source (Drive / local) -> parse -> sinks (SQLite + Supabase).
Run it with ``python -m backend.app.sheet.importer``.
"""
from .parse import ParsedWorkbook, parse_workbook
from .source import resolve_workbook

__all__ = ["ParsedWorkbook", "parse_workbook", "resolve_workbook"]
