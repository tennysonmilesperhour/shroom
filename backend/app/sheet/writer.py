"""Sinks for the reverse direction: write app data *into* a workbook/sheet.

Three interchangeable backends implement the same tiny interface so the
exporter (``export.push``) and the live mirror (``mirror``) don't care where
the bytes end up:

* :class:`XlsxWriter`        — a local .xlsx (openpyxl). Offline, fully tested,
  and the engine the download-workbook endpoint uses.
* :class:`DriveXlsxWriter`   — an .xlsx stored on Google Drive: download the
  current file, mutate it, re-upload. Two-way sync for a binary workbook.
* :class:`GoogleSheetsWriter`— a *native* Google Sheet via the Sheets API v4.
  Cell-level live updates; the recommended source of truth.

Interface (see :class:`SheetWriter`):
    replace_tab(tab, header, rows)  — overwrite a whole worksheet
    append_row(tab, header, row)    — add one row (creating the tab+header if
                                      it doesn't exist yet)
    commit()                        — flush pending changes to the destination

``resolve_writer`` picks a backend from the environment, mirroring how
``source.resolve_workbook`` picks a read source.
"""
from __future__ import annotations

import io
import os
import urllib.parse
from typing import Protocol, runtime_checkable

from openpyxl import Workbook, load_workbook

from . import layout, source


@runtime_checkable
class SheetWriter(Protocol):
    def replace_tab(self, tab: str, header: list[str], rows: list[list]) -> None: ...
    def append_row(self, tab: str, header: list[str], row: list) -> None: ...
    def commit(self) -> None: ...
    def close(self) -> None: ...


# --------------------------------------------------------------------------- #
# openpyxl-backed writers (local .xlsx and Drive .xlsx)
# --------------------------------------------------------------------------- #
class _WorkbookWriter:
    """Shared openpyxl mechanics. Subclasses supply load/save of the bytes."""

    def __init__(self, wb: Workbook):
        self.wb = wb

    @staticmethod
    def _new_or_load(data: bytes | None) -> Workbook:
        if data:
            return load_workbook(io.BytesIO(data))
        wb = Workbook()
        # Drop the default empty "Sheet" so only tabs we write remain.
        wb.remove(wb.active)
        return wb

    def _sheet(self, tab: str, header: list[str], *, create: bool):
        if tab in self.wb.sheetnames:
            return self.wb[tab]
        if not create:
            return None
        ws = self.wb.create_sheet(title=tab)
        ws.append(header)
        return ws

    def replace_tab(self, tab: str, header: list[str], rows: list[list]) -> None:
        if tab in self.wb.sheetnames:
            self.wb.remove(self.wb[tab])
        ws = self.wb.create_sheet(title=tab)
        ws.append(header)
        for row in rows:
            ws.append(list(row))

    def append_row(self, tab: str, header: list[str], row: list) -> None:
        ws = self._sheet(tab, header, create=True)
        ws.append(list(row))

    def to_bytes(self) -> bytes:
        buf = io.BytesIO()
        self.wb.save(buf)
        return buf.getvalue()

    def close(self) -> None:
        self.wb.close()


class InMemoryXlsxWriter(_WorkbookWriter):
    """Build a fresh .xlsx entirely in memory — backs the download endpoint."""

    def __init__(self):
        super().__init__(self._new_or_load(None))

    def commit(self) -> None:  # nothing to flush; caller reads to_bytes()
        pass


class XlsxWriter(_WorkbookWriter):
    """Read-modify-write a local .xlsx. Preserves tabs the app doesn't own."""

    def __init__(self, path: str):
        self.path = path
        data = None
        if os.path.exists(path):
            with open(path, "rb") as fh:
                data = fh.read()
        super().__init__(self._new_or_load(data))

    def commit(self) -> None:
        self.wb.save(self.path)


class DriveXlsxWriter(_WorkbookWriter):
    """Read-modify-write an .xlsx that lives on Google Drive."""

    def __init__(self, file_id: str, token: str):
        self.file_id = file_id
        self.token = token
        data = source.load_bytes_from_drive(file_id, token)
        super().__init__(self._new_or_load(data))

    def commit(self) -> None:
        source.upload_xlsx_to_drive(self.file_id, self.to_bytes(), self.token)


# --------------------------------------------------------------------------- #
# Native Google Sheets writer (Sheets API v4)
# --------------------------------------------------------------------------- #
_SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets/{id}"


class GoogleSheetsWriter:
    """Write into a live Google Sheet cell-by-cell via the values API.

    Unlike the .xlsx writers there's no local workbook: each call is an HTTP
    request, so ``commit`` is a no-op. Missing tabs are created on demand.
    """

    def __init__(self, spreadsheet_id: str, token: str, *, timeout: float = 30.0):
        import httpx  # local import keeps httpx optional for pure-xlsx use

        self.id = spreadsheet_id
        self.base = _SHEETS_API.format(id=spreadsheet_id)
        self.client = httpx.Client(
            timeout=timeout,
            headers={"Authorization": f"Bearer {token}",
                     "Content-Type": "application/json"},
        )
        self._titles: set[str] | None = None

    # -- tab bookkeeping ---------------------------------------------------- #
    def _tab_titles(self) -> set[str]:
        if self._titles is None:
            resp = self.client.get(self.base, params={"fields": "sheets.properties.title"})
            resp.raise_for_status()
            self._titles = {
                s["properties"]["title"] for s in resp.json().get("sheets", [])
            }
        return self._titles

    def _ensure_tab(self, tab: str) -> None:
        if tab in self._tab_titles():
            return
        resp = self.client.post(
            f"{self.base}:batchUpdate",
            json={"requests": [{"addSheet": {"properties": {"title": tab}}}]},
        )
        resp.raise_for_status()
        self._tab_titles().add(tab)

    @staticmethod
    def a1_range(tab: str, cell: str | None = None) -> str:
        """URL-safe A1 range for a tab. Sheet names with spaces or special
        chars (all our tabs — "Grow Cycle Log", "Buyers & Pricing") must be
        single-quoted in A1 notation and percent-encoded in the request path;
        without this the Sheets API rejects the range with a 400."""
        name = "'" + tab.replace("'", "''") + "'"
        rng = f"{name}!{cell}" if cell else name
        return urllib.parse.quote(rng, safe="")

    @staticmethod
    def _values(header: list[str], rows: list[list]) -> list[list[str]]:
        out = [list(header)]
        out.extend([layout.cell_to_str(c) for c in row] for row in rows)
        return out

    # -- SheetWriter interface --------------------------------------------- #
    def replace_tab(self, tab: str, header: list[str], rows: list[list]) -> None:
        self._ensure_tab(tab)
        # Clear the whole tab, then write header + rows from A1.
        self.client.post(
            f"{self.base}/values/{self.a1_range(tab)}:clear"
        ).raise_for_status()
        body = {"values": self._values(header, rows)}
        resp = self.client.put(
            f"{self.base}/values/{self.a1_range(tab, 'A1')}",
            params={"valueInputOption": "USER_ENTERED"},
            json=body,
        )
        resp.raise_for_status()

    def append_row(self, tab: str, header: list[str], row: list) -> None:
        first_time = tab not in self._tab_titles()
        self._ensure_tab(tab)
        values = [] if not first_time else [list(header)]
        values.append([layout.cell_to_str(c) for c in row])
        resp = self.client.post(
            f"{self.base}/values/{self.a1_range(tab, 'A1')}:append",
            params={"valueInputOption": "USER_ENTERED", "insertDataOption": "INSERT_ROWS"},
            json={"values": values},
        )
        resp.raise_for_status()

    def commit(self) -> None:
        pass

    def close(self) -> None:
        self.client.close()


# --------------------------------------------------------------------------- #
# Environment-driven backend selection
# --------------------------------------------------------------------------- #
# Ordered write backends: (env var, kind, needs a Google token). describe_target
# and resolve_writer both consume this so their precedence can't drift.
_WRITE_BACKENDS = (
    ("MASTER_SHEET_GOOGLE_ID", "google_sheet", True),
    ("MASTER_SHEET_FILE_ID", "drive_xlsx", True),
    ("MASTER_SHEET_PATH", "local_xlsx", False),
)


def describe_target() -> dict:
    """Which write backend the environment resolves to, without building it or
    minting a token. Powers /api/sync/status so the UI can tell the operator
    whether write-back is wired up and to where.
    """
    for var, kind, needs_token in _WRITE_BACKENDS:
        ref = os.environ.get(var)
        if ref:
            # credentials_available() only checks env presence — no network.
            writable = (not needs_token) or source.credentials_available()
            return {"configured": True, "kind": kind, "ref": ref, "writable": writable}
    return {"configured": False, "kind": None, "ref": None, "writable": False}


def resolve_writer(*, path: str | None = None, token: str | None = None) -> SheetWriter:
    """Build the configured write backend. Priority mirrors the read source:
    a native Google Sheet id, then an .xlsx on Drive, then a local .xlsx.

    Raises RuntimeError with an actionable message when nothing is configured.
    """
    def _token(var: str) -> str:
        tok = source.resolve_write_token(token=token)
        if not tok:
            raise RuntimeError(
                f"{var} is set but no Google credentials are available. "
                "Set GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_OAUTH_TOKEN."
            )
        return tok

    google_id = os.environ.get("MASTER_SHEET_GOOGLE_ID")
    if google_id:
        return GoogleSheetsWriter(google_id, _token("MASTER_SHEET_GOOGLE_ID"))

    file_id = os.environ.get("MASTER_SHEET_FILE_ID")
    if file_id:
        return DriveXlsxWriter(file_id, _token("MASTER_SHEET_FILE_ID"))

    local = path or os.environ.get("MASTER_SHEET_PATH")
    if local:
        return XlsxWriter(local)

    raise RuntimeError(
        "No write target configured. Set MASTER_SHEET_GOOGLE_ID (a Google "
        "Sheet), MASTER_SHEET_FILE_ID (an .xlsx on Drive), or MASTER_SHEET_PATH "
        "(a local .xlsx)."
    )
