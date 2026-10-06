"""Load the authoritative native Master Sheet through the Sheets API.

Explicit local paths and legacy file IDs remain available for backup recovery.
Native values are converted to an openpyxl workbook for the shared parser.
"""
from __future__ import annotations

import io
import json
import os

import httpx
from openpyxl import load_workbook
from openpyxl.workbook import Workbook

_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"
# Read+write scopes for the reverse (App -> Sheet) direction. Full ``drive``
# (not ``drive.file``, which only covers files the app itself created) so the
# documented flow — share a *pre-existing* workbook with the service account —
# actually works for the Drive .xlsx upload; ``spreadsheets`` powers the native
# Sheets API.
_WRITE_SCOPES = (
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
)

# Native Google-Sheets MIME type (vs. a real .xlsx binary stored on Drive).
GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet"
XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

# Authoritative native Master Sheet; the prior .xlsx is a frozen backup.
DEFAULT_FILE_ID = "1sSsGKaBU4tIP1YGvVVVDS7i2PzuxhiQBPFdezbFRbn8"
_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly"

_DRIVE_MEDIA_URL = "https://www.googleapis.com/drive/v3/files/{id}"
_DRIVE_EXPORT_URL = "https://www.googleapis.com/drive/v3/files/{id}/export"
_DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files/{id}"


def load_bytes_from_drive(file_id: str, token: str, *, timeout: float = 30.0) -> bytes:
    """Download an .xlsx from Google Drive via the v3 media endpoint."""
    resp = httpx.get(
        _DRIVE_MEDIA_URL.format(id=file_id),
        params={"alt": "media", "supportsAllDrives": "true"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=timeout,
        follow_redirects=True,
    )
    resp.raise_for_status()
    return resp.content


def export_google_sheet(file_id: str, token: str, *, timeout: float = 30.0) -> bytes:
    """Export a *native* Google Sheet as .xlsx bytes.

    A Google Sheet has no binary to media-download; Drive exports it on the fly.
    This is what lets a Google Sheet — not just an uploaded .xlsx — be the
    source of truth.
    """
    resp = httpx.get(
        _DRIVE_EXPORT_URL.format(id=file_id),
        params={"mimeType": XLSX_MIME},
        headers={"Authorization": f"Bearer {token}"},
        timeout=timeout,
        follow_redirects=True,
    )
    resp.raise_for_status()
    return resp.content


def drive_mime_type(file_id: str, token: str, *, timeout: float = 30.0) -> str:
    """Return a Drive file's MIME type so callers can pick media vs. export."""
    resp = httpx.get(
        _DRIVE_MEDIA_URL.format(id=file_id),
        params={"fields": "mimeType", "supportsAllDrives": "true"},
        headers={"Authorization": f"Bearer {token}"},
        timeout=timeout,
        follow_redirects=True,
    )
    resp.raise_for_status()
    return resp.json().get("mimeType", "")


def load_workbook_bytes(file_id: str, token: str, *, timeout: float = 30.0) -> bytes:
    """.xlsx bytes for any Drive file — exports native Sheets, media-downloads
    a real .xlsx — so the reader doesn't care which kind it is."""
    if drive_mime_type(file_id, token, timeout=timeout) == GOOGLE_SHEET_MIME:
        return export_google_sheet(file_id, token, timeout=timeout)
    return load_bytes_from_drive(file_id, token, timeout=timeout)


def upload_xlsx_to_drive(file_id: str, data: bytes, token: str, *,
                         timeout: float = 60.0) -> None:
    """Overwrite an existing Drive .xlsx file's contents (media update).

    Used by the write-back path when the source of truth is a binary .xlsx on
    Drive rather than a native Google Sheet.
    """
    resp = httpx.patch(
        _DRIVE_UPLOAD_URL.format(id=file_id),
        params={"uploadType": "media", "supportsAllDrives": "true"},
        headers={"Authorization": f"Bearer {token}", "Content-Type": XLSX_MIME},
        content=data,
        timeout=timeout,
    )
    resp.raise_for_status()


def _service_account_token(raw_json: str, scopes=(_DRIVE_SCOPE,)) -> str:
    """Mint a Google access token from a service-account key JSON."""
    # Imported lazily so the local/path workflow needs no Google libraries.
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request

    creds = service_account.Credentials.from_service_account_info(
        json.loads(raw_json), scopes=list(scopes)
    )
    creds.refresh(Request())
    return creds.token


def resolve_token(scopes=(_DRIVE_SCOPE,), *, token: str | None = None) -> str | None:
    """Best available Google access token for ``scopes`` from the environment.

    Prefers a service-account key (``GOOGLE_SERVICE_ACCOUNT_JSON``, never
    expires); falls back to a short-lived OAuth token. An explicit ``token``
    wins outright. Returns None when nothing is configured.
    """
    if token:
        return token
    sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
    if sa_json:
        return _service_account_token(sa_json, scopes)
    return os.environ.get("GOOGLE_OAUTH_TOKEN") or os.environ.get("GOOGLE_ACCESS_TOKEN")


def resolve_write_token(*, token: str | None = None) -> str | None:
    """A token with read+write scope for the App -> Sheet direction."""
    return resolve_token(_WRITE_SCOPES, token=token)


def credentials_available() -> bool:
    """Whether *some* Google credential is configured — without minting a
    token. Callers reporting status must use this rather than resolve_token,
    which does a network refresh for a service-account key."""
    return bool(
        os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
        or os.environ.get("GOOGLE_OAUTH_TOKEN")
        or os.environ.get("GOOGLE_ACCESS_TOKEN")
    )


def resolve_read_file_id(file_id: str | None = None) -> str:
    """The Drive file id the read path pulls from, in precedence order. A
    native Google Sheet (``MASTER_SHEET_GOOGLE_ID``) counts as a source —
    ``load_workbook_bytes`` exports it — so pull and status agree on the file."""
    return (
        file_id
        or os.environ.get("MASTER_SHEET_GOOGLE_ID")
        or os.environ.get("MASTER_SHEET_FILE_ID")
        or DEFAULT_FILE_ID
    )


def describe_source() -> dict:
    """Describe the configured read source without doing any I/O. Single source
    of truth for both ``resolve_workbook`` and the /api/sync/status endpoint."""
    path = os.environ.get("MASTER_SHEET_PATH")
    if path:
        return {"configured": True, "kind": "local_xlsx", "ref": path}
    for kind, var in (("google_sheet", "MASTER_SHEET_GOOGLE_ID"),
                      ("drive_xlsx", "MASTER_SHEET_FILE_ID")):
        ref = os.environ.get(var)
        if ref:
            return {"configured": True, "kind": kind, "ref": ref}
    return {"configured": credentials_available(), "kind": "google_sheet", "ref": DEFAULT_FILE_ID}


def resolve_workbook(path: str | None = None, file_id: str | None = None,
                     token: str | None = None) -> Workbook:
    """Return a read-only openpyxl workbook from the configured source.

    Explicit arguments win; otherwise the environment is consulted. Raises
    RuntimeError with an actionable message when nothing is configured.
    """
    path = path or os.environ.get("MASTER_SHEET_PATH")
    if path:
        return load_workbook(path, read_only=True, data_only=True)

    file_id = resolve_read_file_id(file_id)
    token = resolve_token((_DRIVE_SCOPE, _SHEETS_SCOPE), token=token)
    if file_id and token:
        # load_workbook_bytes handles both a native Google Sheet (exported) and
        # a real .xlsx (media-downloaded).
        if file_id == DEFAULT_FILE_ID or file_id == os.environ.get("MASTER_SHEET_GOOGLE_ID"):
            return load_google_sheet(file_id, token)
        data = load_workbook_bytes(file_id, token)
        return load_workbook(io.BytesIO(data), read_only=True, data_only=True)

    raise RuntimeError(
        "No workbook source configured. Set MASTER_SHEET_PATH to a local .xlsx, "
        "or GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_OAUTH_TOKEN (+ optional "
        "MASTER_SHEET_FILE_ID / MASTER_SHEET_GOOGLE_ID) to pull it from Google Drive."
    )


def load_google_sheet(file_id: str, token: str) -> Workbook:
    """Read evaluated values through Sheets API; retain the existing tab parser."""
    response = httpx.get(
        f"https://sheets.googleapis.com/v4/spreadsheets/{file_id}",
        params={"includeGridData": "true", "fields": "sheets(properties(title),data(startRow,startColumn,rowData(values(effectiveValue,effectiveFormat(numberFormat)))))"},
        headers={"Authorization": f"Bearer {token}"}, timeout=60,
    )
    response.raise_for_status()
    wb = Workbook()
    wb.remove(wb.active)
    for tab in response.json().get("sheets", []):
        ws = wb.create_sheet(tab["properties"]["title"])
        for grid in tab.get("data", []):
            for row_index, row in enumerate(grid.get("rowData", [])):
                for col_index, cell in enumerate(row.get("values", [])):
                    value = cell.get("effectiveValue", {})
                    actual = next((value[k] for k in ("numberValue", "stringValue", "boolValue") if k in value), None)
                    target = ws.cell(grid.get("startRow", 0) + row_index + 1, grid.get("startColumn", 0) + col_index + 1, actual)
                    fmt = cell.get("effectiveFormat", {}).get("numberFormat", {})
                    if fmt.get("type") in ("DATE", "DATE_TIME") and isinstance(actual, (int, float)):
                        from openpyxl.utils.datetime import from_excel
                        target.value = from_excel(actual)
    return wb
