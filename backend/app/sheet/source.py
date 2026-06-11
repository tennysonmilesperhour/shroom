"""Locate and load the Master Cultivation Reference workbook.

The sheet is the single source of truth. It lives in the operator's synced
"Mushrooms" Google Drive folder as a real .xlsx. This module returns an openpyxl
workbook from whichever source is configured, in priority order:

  1. ``--path`` / ``MASTER_SHEET_PATH``  — a local .xlsx (synced Drive folder,
     a checked-out fixture, or a manual download). Best for offline / CI.
  2. Google Drive media download of ``MASTER_SHEET_FILE_ID`` using either a
     service-account key (``GOOGLE_SERVICE_ACCOUNT_JSON``, recommended — never
     expires, set once) or a short-lived OAuth access token
     (``GOOGLE_OAUTH_TOKEN``). Best for an unattended / button-triggered sync.

Keeping the fetch behind one function means the parser and sinks never care
where the bytes came from.
"""
from __future__ import annotations

import io
import json
import os

import httpx
from openpyxl import load_workbook
from openpyxl.workbook import Workbook

_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"

# The canonical file in Isaac's Drive ("Master Cultivation Reference.xlsx").
DEFAULT_FILE_ID = "1KJSAauzZ-CBpA1f4hDISsLzAiFnoh4jC"

_DRIVE_MEDIA_URL = "https://www.googleapis.com/drive/v3/files/{id}"


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


def _service_account_token(raw_json: str) -> str:
    """Mint a Drive read-only access token from a service-account key JSON."""
    # Imported lazily so the local/path workflow needs no Google libraries.
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request

    creds = service_account.Credentials.from_service_account_info(
        json.loads(raw_json), scopes=[_DRIVE_SCOPE]
    )
    creds.refresh(Request())
    return creds.token


def resolve_workbook(path: str | None = None, file_id: str | None = None,
                     token: str | None = None) -> Workbook:
    """Return a read-only openpyxl workbook from the configured source.

    Explicit arguments win; otherwise the environment is consulted. Raises
    RuntimeError with an actionable message when nothing is configured.
    """
    path = path or os.environ.get("MASTER_SHEET_PATH")
    if path:
        return load_workbook(path, read_only=True, data_only=True)

    file_id = file_id or os.environ.get("MASTER_SHEET_FILE_ID") or DEFAULT_FILE_ID
    if token is None:
        sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
        token = (
            _service_account_token(sa_json) if sa_json
            else os.environ.get("GOOGLE_OAUTH_TOKEN") or os.environ.get("GOOGLE_ACCESS_TOKEN")
        )
    if file_id and token:
        data = load_bytes_from_drive(file_id, token)
        return load_workbook(io.BytesIO(data), read_only=True, data_only=True)

    raise RuntimeError(
        "No workbook source configured. Set MASTER_SHEET_PATH to a local .xlsx, "
        "or GOOGLE_SERVICE_ACCOUNT_JSON / GOOGLE_OAUTH_TOKEN (+ optional "
        "MASTER_SHEET_FILE_ID) to pull it from Google Drive."
    )
